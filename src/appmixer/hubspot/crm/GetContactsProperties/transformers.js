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
                        value: 'properties.' + property.name
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
