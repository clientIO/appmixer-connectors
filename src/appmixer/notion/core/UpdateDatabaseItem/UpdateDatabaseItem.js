'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {
        if (context.properties.generateInspector) {
            return generateInspector(context);
        }

        const { databaseId, itemId, content } = context.messages.in.content;

        const itemData = await formatPropertiesForNotion(context, databaseId, context.messages.in.content);

        const requestData = {
            properties: itemData
        };

        // Update the properties using PATCH
        const response = await lib.callEndpoint(context, `/pages/${itemId}`, {
            method: 'PATCH',
            data: requestData
        });

        // If content is provided, update the first block
        if (content) {
            const firstBlockId = await getFirstTextBlockId(context, itemId);
            if (firstBlockId) {
                await updateFirstTextBlock(context, firstBlockId, content);
            }
        }

        return context.sendJson(response.data, 'out');
    }
};

async function generateInspector(context) {
    const { databaseId } = context.properties;

    const schema = {
        type: 'object',
        properties: {
            databaseId: { type: 'string' },
            itemId: { type: 'string' },
            content: { type: 'string' }
        },
        required: ['databaseId', 'itemId']  // We need both the database ID and the item ID to update
    };

    let fieldsInputs = {};

    if (databaseId) {
        const { data: databaseDetails } = await lib.callEndpoint(context, `/databases/${databaseId}`);

        fieldsInputs = Object.keys(databaseDetails.properties).reduce((res, propertyName, index) => {
            const property = databaseDetails.properties[propertyName];
            if (isSupportedPropertyType(property.type)) {
                const inputConfig = {
                    index: index + 2,
                    when: { regex: { 'itemId': '.+' } },
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
            tooltip: 'Select the Notion database or insert a Database ID where the item you want to update is located.'
        },
        itemId: {
            label: 'Item ID',
            index: 2,
            type: 'select',
            source: {
                url: '/component/appmixer/notion/core/ListDatabaseItems?outPort=out',
                data: {
                    messages: {
                        'in/databaseId': 'inputs/in/databaseId'
                    },
                    properties: {
                        'sendWholeArray': true
                    },
                    transform: './ListDatabaseItems#pagesToSelectArray'
                }
            },
            tooltip: 'Select the database item or enter the ID of the database item you want to update.'
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

// Function to fetch the first text block (paragraph or header) of the page
async function getFirstTextBlockId(context, pageId) {
    const { data: blocks } = await lib.callEndpoint(context, `/blocks/${pageId}/children`, {
        method: 'GET'
    });

    for (const block of blocks.results) {
        if (block.type === 'paragraph' || block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3') {
            return block.id;
        }
    }

    // No text block found
    return null;
}

// Function to update the first text block with the provided content
async function updateFirstTextBlock(context, blockId, content) {
    const blockData = {
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
    };

    // Patch the block with the new content
    await lib.callEndpoint(context, `/blocks/${blockId}`, {
        method: 'PATCH',
        data: blockData
    });
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
