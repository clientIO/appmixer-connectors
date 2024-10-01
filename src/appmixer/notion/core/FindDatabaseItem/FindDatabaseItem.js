'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {
        if (context.properties.generateInspector) {
            return generateInspector(context);
        }

        const { databaseId, dateFilter, dateValue, ...propertyFilters } = context.messages.in.content;

        const filters = [];

        // Retrieve the database schema
        const { data: databaseDetails } = await lib.callEndpoint(context, `/databases/${databaseId}`);

        let datePropertyName = null;

        // Find the date property name from the database schema
        for (const propertyName in databaseDetails.properties) {
            const property = databaseDetails.properties[propertyName];

            // Check if the property type is 'date' and store the property name
            if (property.type === 'date') {
                datePropertyName = propertyName;  // This is the date field we are filtering on
            }
        }

        // Ensure we have a valid date property name
        if (datePropertyName && dateFilter && dateValue) {
            filters.push({
                property: datePropertyName, // Use the actual date property name
                date: {
                    [dateFilter]: dateValue // Apply the filter dynamically based on the dateFilter selected
                }
            });
        }

        // Apply other property filters (for Title, Phone, Text, Email, URL)
        for (const propertyName in propertyFilters) {
            const property = databaseDetails.properties[propertyName];
            const userInput = propertyFilters[propertyName];

            if (userInput) {
                // Switch case to apply the correct filter type based on the property type
                switch (property.type) {
                    case 'title':
                        filters.push({
                            property: propertyName,
                            title: {
                                contains: userInput // For title fields, use the 'title' key
                            }
                        });
                        break;
                    case 'rich_text':
                        filters.push({
                            property: propertyName,
                            rich_text: {
                                contains: userInput
                            }
                        });
                        break;
                    case 'phone_number':
                        filters.push({
                            property: propertyName,
                            phone_number: {
                                contains: userInput
                            }
                        });
                        break;
                    case 'email':
                        filters.push({
                            property: propertyName,
                            email: {
                                contains: userInput
                            }
                        });
                        break;
                    case 'url':
                        filters.push({
                            property: propertyName,
                            url: {
                                contains: userInput
                            }
                        });
                        break;
                    default:
                        context.log(`Unsupported property type: ${property.type}`);
                        break;
                }
            }
        }

        // Perform the search with combined filters and sorting
        const response = await lib.callEndpoint(context, `/databases/${databaseId}/query`, {
            method: 'POST',
            data: {
                filter: { and: filters },  // Combine all filters
                sorts: [
                    {
                        timestamp: 'last_edited_time',
                        direction: 'descending'  // Sort by last_edited_time in descending order
                    }
                ]
            }
        });

        // Check if there are no results
        if (response.data.results.length === 0) {
            return context.send('Item not found', 'notFound');  // Send to 'notFound' port
        }

        const firstItem = response.data.results[0];  // Get the first result after sorting

        return context.sendJson(firstItem, 'out');  // Return the first item as a single object
    }
};

async function generateInspector(context) {
    const { databaseId } = context.properties;

    const schema = {
        type: 'object',
        properties: {
            databaseId: { type: 'string' }
        },
        required: ['databaseId']
    };

    let fieldsInputs = {};

    if (databaseId) {
        const { data: databaseDetails } = await lib.callEndpoint(context, `/databases/${databaseId}`);

        // Loop through properties of the database
        fieldsInputs = Object.keys(databaseDetails.properties).reduce((res, propertyName, index) => {
            const property = databaseDetails.properties[propertyName];

            // Add the supported property types: Title, Phone, Text, Email, URL
            if (['title', 'phone_number', 'rich_text', 'email', 'url'].includes(property.type)) {
                const inputConfig = {
                    index: index + 2,
                    type: getInputType(property),
                    name: propertyName,
                    label: propertyName,
                    tooltip: getTooltipText(property)
                };
                res[propertyName] = inputConfig;
            }

            // Handle Date fields separately
            if (property.type === 'date') {
                const datePropertyName = propertyName;  // This will dynamically name the field

                // Add the Date Filter select field
                res['dateFilter'] = {
                    label: 'Select Date Filter',
                    type: 'select',
                    index: index + 2,
                    options: [
                        { value: 'before', content: 'Before' },
                        { value: 'after', content: 'After' },
                        { value: 'on_or_before', content: 'On or Before' },
                        { value: 'on_or_after', content: 'On or After' }
                    ],
                    tooltip: 'Select how to filter the date value.'
                };

                // Add the actual date field with the dynamic name (e.g., "Event Time")
                res['dateValue'] = {
                    label: datePropertyName,
                    type: 'date-time',
                    index: index + 3,
                    tooltip: `Enter the date for the ${datePropertyName}`,
                    when: { regex: { 'dateFilter': '.+' } }  // Only show if a filter is selected
                };
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
            tooltip: 'Select the Notion database where you want to search for items.'
        },
        ...fieldsInputs
    };

    return context.sendJson({ schema, inputs }, 'out');
}

function getInputType(property) {
    switch (property.type) {
        case 'title':
        case 'rich_text':
        case 'url':
        case 'email':
        case 'phone_number':
            return 'text';
        case 'date':
            return 'date-time';
        default:
            return 'text';
    }
}

function getTooltipText(property) {
    switch (property.type) {
        case 'title':
            return 'Enter the title for the item.';
        case 'rich_text':
            return 'Enter the text content.';
        case 'phone_number':
            return 'Enter the phone number.';
        case 'email':
            return 'Enter the email address.';
        case 'url':
            return 'Enter the URL.';
        case 'date':
            return 'Enter a date for filtering the records.';
        default:
            return `Enter the value for ${property.name}.`;
    }
}
