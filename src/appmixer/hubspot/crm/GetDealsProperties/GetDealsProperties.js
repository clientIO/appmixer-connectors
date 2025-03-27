'use strict';
const Hubspot = require('../../Hubspot');
const { getObjectProperties } = require('../../commons');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);
        const properties = await getObjectProperties(context, hs, 'deals', 'all');

        return context.sendJson(properties, 'out');
    },

    dealsPropertiesToDealInspector(dealsProperties) {

        let inspector = {
            inputs: {
                dealsProperties: {}
            }
        };
        if (Array.isArray(dealsProperties)) {
            let index = 1;
            dealsProperties.forEach((property) => {
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
                    inspector.inputs.dealsProperties[property.name] = field;
                }
            });
        }

        return inspector;
    },

    /** Only returns properties where `createdUserId` exists. */
    customFieldsToSelectArray(contactsProperties) {

        return contactsProperties
            .filter((property) => property.createdUserId)
            .filter((property) => property.formField)
            .map((property) => {
                return { label: property.label, value: property.name };
            });
    },

    dealToLabelNameArray(dealsProperties) {

        const transformed = [];
        if (Array.isArray(dealsProperties)) {
            dealsProperties.forEach((property) => {
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

    dealToSelectArray(dealsProperties) {

        const transformed = [];
        if (Array.isArray(dealsProperties)) {
            dealsProperties.forEach((property) => {
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
