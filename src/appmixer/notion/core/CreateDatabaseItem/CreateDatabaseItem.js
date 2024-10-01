'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {
        if (context.properties.generateInspector) {
            return generateInspector(context);
        }

        const { databaseId, content } = context.messages.in.content;

        const itemData = await formatPropertiesForNotion(context, databaseId, context.messages.in.content);

        const requestData = {
            parent: { database_id: databaseId },
            properties: itemData
        };

        // Add content if provided
        if (content) {
            requestData.children = [
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [
                            {
                                type: 'text',
                                text: {
                                    content: content
                                }
                            }
                        ]
                    }
                }
            ];
        }

        const response = await lib.callEndpoint(context, '/pages', {
            method: 'POST',
            data: requestData
        });

        return context.sendJson(response.data, 'out');
    }
};

async function generateInspector(context) {
    const { databaseId } = context.properties;

    const schema = {
        type: 'object',
        properties: {
            databaseId: { type: 'string' },
            content: { type: 'string' }
        },
        required: ['databaseId']
    };

    let fieldsInputs = {};

    if (databaseId) {
        const { data: databaseDetails } = await lib.callEndpoint(context, `/databases/${databaseId}`);

        fieldsInputs = Object.keys(databaseDetails.properties).reduce((res, propertyName, index) => {
            const property = databaseDetails.properties[propertyName];
            if (isSupportedPropertyType(property.type)) {
                const inputConfig = {
                    index: index + 2,
                    type: getInputType(property),
                    name: propertyName,
                    label: propertyName,
                    tooltip: getTooltipText(property),
                    ...(property.type === 'select' || property.type === 'multi_select' || property.type === 'status' ? { options: getSelectOptions(property) } : {})
                };

                if (property.type === 'people') {
                    inputConfig.type = 'multiselect';
                    inputConfig.source = {
                        url: '/component/appmixer/notion/core/ListUsers?outPort=out',
                        data: {
                            transform: './ListUsers#usersToSelectArray'
                        }
                    };
                    inputConfig.mergeVariables = false;
                }

                res[propertyName] = inputConfig;
            }
            return res;
        }, {});
    }

    const inputs = {
        databaseId: {
            label: 'Database ID',
            index: 1,
            type: 'select',
            source: {
                url: '/component/appmixer/notion/core/ListDatabases?outPort=out',
                data: {
                    transform: './ListDatabases#databaseToSelectArray'
                }
            },
            tooltip: 'Select the Notion database or insert a Database ID where you want to create a new item.'
        },
        content: {
            label: 'Content',
            index: 999,  // Ensure this appears last in the form
            type: 'text',
            tooltip: 'Enter the content for the item.'
        },
        ...fieldsInputs
    };

    return context.sendJson({ schema, inputs }, 'out');
}

async function formatPropertiesForNotion(context, databaseId, content) {
    const { data: databaseDetails } = await lib.callEndpoint(context, `/databases/${databaseId}`);

    const formattedProperties = {};

    for (const propertyName in databaseDetails.properties) {
        if (databaseDetails.properties.hasOwnProperty(propertyName)) {
            const property = databaseDetails.properties[propertyName];
            const userInput = content[propertyName];

            if (userInput !== undefined && userInput !== null) {
                formattedProperties[propertyName] = formatProperty(property, userInput);
            }
        }
    }

    return formattedProperties;
}

function formatProperty(property, userInput) {
    switch (property.type) {
        case 'title':
            return {
                'title': [{ 'text': { 'content': userInput } }]
            };
        case 'rich_text':
            return {
                'rich_text': [{ 'text': { 'content': userInput } }]
            };
        case 'multi_select':
            return {
                'multi_select': Array.isArray(userInput) ? userInput.map(option => ({ 'name': option })) : [{ 'name': userInput }]
            };
        case 'select':
            return {
                'select': { 'name': userInput }
            };
        case 'status':
            return {
                'status': { 'name': userInput }
            };
        case 'people':
            return {
                'people': Array.isArray(userInput) ? userInput.map(personId => ({ 'id': personId })) : [{ 'id': userInput }]
            };
        case 'date':
            return {
                'date': { 'start': userInput }
            };
        case 'checkbox':
            return {
                'checkbox': Boolean(userInput)
            };
        case 'number':
            return {
                'number': parseFloat(userInput)
            };
        case 'email':
            return {
                'email': userInput
            };
        case 'url':
            return {
                'url': userInput
            };
        case 'phone_number':
            return {
                'phone_number': userInput
            };
        case 'files':
            const files = [];
            if (Array.isArray(userInput)) {
                for (const fileUrl of userInput) {
                    files.push({
                        'name': fileUrl.split('/').pop(),
                        'external': { 'url': fileUrl.trim() }
                    });
                }
            } else {
                files.push({
                    'name': userInput.split('/').pop(),
                    'external': { 'url': userInput.trim() }
                });
            }
            return { 'files': files };
        default:
            return {
                [property.type]: userInput
            };
    }
}

function getInputType(property) {
    switch (property.type) {
        case 'title':
        case 'rich_text':
        case 'url':
        case 'email':
        case 'phone_number':
            return 'text';
        case 'number':
            return 'number';
        case 'checkbox':
            return 'toggle';
        case 'date':
            return 'date-time';
        case 'multi_select':
            return 'multiselect';
        case 'status':
        case 'select':
            return 'select';
        case 'people':
            return 'multiselect';
        case 'files':
            return 'text';
        default:
            return 'text';
    }
}

function getSelectOptions(property) {
    if (property.type === 'select' || property.type === 'multi_select' || property.type === 'status') {
        return property[property.type].options.map(option => ({
            value: option.name,
            content: option.name
        }));
    }
    return [];
}

function getTooltipText(property) {
    switch (property.type) {
        case 'title':
            return 'Enter the title for the item. This is the main heading.';
        case 'rich_text':
            return 'Enter the text content.';
        case 'multi_select':
        case 'status':
            return 'Select one option from the list';
        case 'select':
            return 'Select a single option from the dropdown.';
        case 'people':
            return 'Select people by their user ID. Use the dropdown to search for users.';
        case 'date':
            return 'Enter a date with or without time.';
        case 'checkbox':
            return 'Toggle the checkbox on or off.';
        case 'number':
            return 'Enter a numerical value.';
        case 'email':
            return 'Enter an email address.';
        case 'url':
            return 'Enter a URL.';
        case 'phone_number':
            return 'Enter a phone number.';
        case 'files':
            return 'Enter URLs for files, separated by commas.';
        default:
            return `Enter the value for the ${property.name} field.`;
    }
}

function isSupportedPropertyType(type) {
    return [
        'title', 'rich_text', 'multi_select', 'select', 'people', 'date',
        'checkbox', 'number', 'email', 'url', 'phone_number', 'files', 'status'
    ].includes(type);
}
