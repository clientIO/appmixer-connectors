'use strict';

const lib = require('../../lib');

const fieldQuery = `
    query($fieldId: ID!) {
        node(id: $fieldId) {
            __typename
            ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
            }
            ... on ProjectV2IterationField {
                id
                name
                configuration {
                    iterations { id title }
                    completedIterations { id title }
                }
            }
            ... on ProjectV2Field {
                id
                name
                dataType
            }
        }
    }
`;

const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: $value
        }) {
            projectV2Item { id }
        }
    }
`;

const readBackQuery = `
    query($itemId: ID!) {
        node(id: $itemId) {
            ... on ProjectV2Item {
                fieldValues(first: 50) {
                    nodes {
                        ... on ProjectV2ItemFieldTextValue {
                            text
                            field { ... on ProjectV2Field { id } }
                        }
                        ... on ProjectV2ItemFieldNumberValue {
                            number
                            field { ... on ProjectV2Field { id } }
                        }
                        ... on ProjectV2ItemFieldDateValue {
                            date
                            field { ... on ProjectV2Field { id } }
                        }
                        ... on ProjectV2ItemFieldSingleSelectValue {
                            optionId
                            field { ... on ProjectV2SingleSelectField { id } }
                        }
                        ... on ProjectV2ItemFieldIterationValue {
                            iterationId
                            field { ... on ProjectV2IterationField { id } }
                        }
                    }
                }
            }
        }
    }
`;

/**
 * The board's own built-in automations write to the same item, so a mutation can be
 * overwritten microseconds later. Everything below is expressed as a comparable
 * string so the write can be read back and compared.
 */
const stringify = value => (value === null || value === undefined ? '' : String(value));

const toDateOnly = value => {

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? stringify(value) : parsed.toISOString().slice(0, 10);
};

const findOption = (options, value) => {

    const wanted = stringify(value).trim().toLowerCase();
    // Accept the option name (what a human types) as well as a raw option ID.
    return options.find(option => stringify(option.name).trim().toLowerCase() === wanted)
        || options.find(option => option.id === value);
};

const readCurrentValue = async (context, itemId, fieldId) => {

    const data = await lib.graphqlRequest(context, readBackQuery, { itemId });
    const nodes = data?.node?.fieldValues?.nodes || [];
    const node = nodes.find(fieldValue => fieldValue?.field?.id === fieldId);

    if (!node) return '';
    if (node.optionId !== undefined) return stringify(node.optionId);
    if (node.iterationId !== undefined) return stringify(node.iterationId);
    if (node.number !== undefined) return stringify(node.number);
    if (node.date !== undefined) return stringify(node.date);
    return stringify(node.text);
};

module.exports = {

    async receive(context) {

        const { projectId, itemId, fieldId, valueType = 'single_select', value } = context.messages.in.content;

        if (!projectId) {
            throw new context.CancelError('Project ID is required!');
        }
        if (!itemId) {
            throw new context.CancelError('Item ID is required!');
        }
        if (!fieldId) {
            throw new context.CancelError('Field ID is required!');
        }
        if (value === undefined || value === null || value === '') {
            throw new context.CancelError('Value is required!');
        }

        let fieldValue;
        let expected;

        if (valueType === 'single_select' || valueType === 'iteration') {

            const fieldData = await lib.graphqlRequest(context, fieldQuery, { fieldId });
            const field = fieldData?.node;
            if (!field) {
                throw new context.CancelError(`Field with ID '${fieldId}' not found.`);
            }

            if (valueType === 'single_select') {
                const options = field.options || [];
                const option = findOption(options, value);
                if (!option) {
                    throw new context.CancelError(
                        `Single select option '${value}' not found on field '${field.name}'. Available options: ${options.map(o => o.name).join(', ')}.`
                    );
                }
                fieldValue = { singleSelectOptionId: option.id };
                expected = option.id;
            } else {
                const iterations = (field.configuration?.iterations || [])
                    .concat(field.configuration?.completedIterations || [])
                    .map(iteration => ({ id: iteration.id, name: iteration.title }));
                const iteration = findOption(iterations, value);
                if (!iteration) {
                    throw new context.CancelError(
                        `Iteration '${value}' not found on field '${field.name}'. Available iterations: ${iterations.map(i => i.name).join(', ')}.`
                    );
                }
                fieldValue = { iterationId: iteration.id };
                expected = iteration.id;
            }

        } else if (valueType === 'number') {

            const number = Number(value);
            if (Number.isNaN(number)) {
                throw new context.CancelError(`Value '${value}' is not a valid number.`);
            }
            fieldValue = { number };
            expected = stringify(number);

        } else if (valueType === 'date') {

            const date = toDateOnly(value);
            // toDateOnly() falls back to the raw input when it can't parse; reject that here
            // so an unparseable date fails with an actionable error instead of a GraphQL one.
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                throw new context.CancelError(`Value '${value}' is not a valid date.`);
            }
            fieldValue = { date };
            expected = date;

        } else if (valueType === 'text') {

            fieldValue = { text: stringify(value) };
            expected = stringify(value);

        } else {
            throw new context.CancelError(`Unsupported value type '${valueType}'.`);
        }

        let actual;
        // One retry: the board's built-in automations can race the write.
        for (let attempt = 1; attempt <= 2; attempt++) {
            await lib.graphqlRequest(context, mutation, { projectId, itemId, fieldId, value: fieldValue });
            actual = await readCurrentValue(context, itemId, fieldId);
            if (actual === expected) {
                return context.sendJson({}, 'out');
            }
            await context.log({
                step: 'Field value read back does not match the value written, retrying.',
                itemId, fieldId, expected, actual, attempt
            });
        }

        throw new context.CancelError(
            `Field '${fieldId}' on item '${itemId}' still reads '${actual}' after two attempts to set '${expected}'. Another automation is likely overwriting it.`
        );
    }
};
