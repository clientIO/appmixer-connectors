// Map a HubSpot property definition to a JSON schema (with an example) so the
// designer's variable picker can show variable types and sample values.
// Note: HubSpot returns every property value as a string in the API response,
// so number/bool map to type string with a representative example.
function propertyToSchema(property) {

    switch (property.type) {
        case 'number':
            return { type: 'string', example: '42' };
        case 'phone_number':
            return { type: 'string', example: '+15551234567' };
        case 'datetime':
            return { type: 'string', format: 'date-time', example: '2026-07-24T12:00:00.000Z' };
        case 'date':
            return { type: 'string', format: 'date', example: '2026-07-24' };
        case 'bool':
            return { type: 'string', example: 'true' };
        case 'enumeration': {
            const first = (property.options || [])[0];
            return { type: 'string', example: first ? String(first.value) : 'option_value' };
        }
        default:
            return { type: 'string', example: 'Sample text' };
    }
}

module.exports = {

    contactToLabelNameArray: (contactsProperties) => {

        const transformed = [];
        if (Array.isArray(contactsProperties)) {
            contactsProperties.forEach((property) => {
                if (!property.hidden) {
                    transformed.push({
                        label: property.label || property.name,
                        value: property.name
                    });
                }
            });
        }
        return transformed;
    },

    contactToSelectArray(contactsProperties) {

        const transformed = [];
        if (Array.isArray(contactsProperties)) {
            contactsProperties.forEach((property) => {
                if (!property.hidden) {
                    transformed.push({
                        label: property.label || property.name,
                        value: 'properties.' + property.name,
                        schema: propertyToSchema(property)
                    });
                }
            });
        }
        return transformed;
    },

    contactsToSchema(contactsProperties) {

        const contactProperties = {};
        if (Array.isArray(contactsProperties)) {
            contactsProperties.forEach((property) => {
                if (!property.hidden) {

                    contactProperties[property.name] = {
                        title: property.label || property.name
                    };
                }
            });
        }

        return {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    // id: { type: 'string', title: 'id' },
                    properties: {
                        type: 'object', title: 'properties',
                        properties: contactProperties
                    }
                    // createdAt: { type: 'string', title: 'createdAt' },
                    // updatedAt: { type: 'string', title: 'updatedAt' },
                    // archived: { type: 'boolean', title: 'archived' }
                }
            }
        };
    }
};
