'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);
        const { data } = await hs.call('get', 'crm/v3/properties/taxes');

        return context.sendJson(data.results, 'out');
    },

    taxesPropertiesToTaxesInspector(taxesProperties) {

        let inspector = {
            inputs: {
                taxesProperties: {}
            }
        };
        if (Array.isArray(taxesProperties)) {
            let index = 1;
            taxesProperties.forEach((property) => {
                if (!property.hidden) {

                    let field = {
                        type: 'text',
                        label: property.label || property.name,
                        index: index++
                    };

                    switch (property.type) {
                        case 'string':
                            field.type = property.fieldType === 'textarea' ? 'textarea' : 'text';
                            break;
                        case 'number':
                            field.type = 'number';
                            break;
                        case 'phone_number':
                            field.type = 'text';
                            break;
                        case 'datetime':
                            field.type = 'date-time';
                            break;
                        case 'date':
                            field.type = 'date-time';
                            break;
                        case 'bool':
                            field.type = 'toggle';
                            break;
                        case 'enumeration':
                            field.type = 'select';
                            field.options = (property.options || []).map((option) => {
                                return { content: option.label, value: option.value };
                            });
                            break;
                    }
                    inspector.inputs.taxesProperties[property.name] = field;
                }
            });
        }

        return inspector;
    },

    taxesToSelectArray(taxesProperties) {

        const transformed = [];
        if (Array.isArray(taxesProperties)) {
            taxesProperties.forEach((property) => {
                if (!property.hidden) {
                    transformed.push({
                        label: property.label || property.name,
                        value: 'properties.' + property.name
                    });
                }
            });
        }
        return transformed;
    }
};
