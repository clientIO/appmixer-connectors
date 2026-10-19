'use strict';

const Hubspot = require('../../Hubspot');
const { getObjectProperties, INSPECTOR_FIELDS_COMPANY } = require('../../commons');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);
        const properties = await getObjectProperties(context, hs, 'companies', 'all');

        return context.sendJson(properties, 'out');
    },

    companiesPropertiesToCompanyInspector(companiesProperties) {

        let inspector = {
            inputs: {
                companiesProperties: {}
            }
        };
        if (Array.isArray(companiesProperties)) {
            let index = 1;
            companiesProperties.forEach((property) => {
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
                    inspector.inputs.companiesProperties[property.name] = field;
                }
            });
        }

        return inspector;
    },

    /** Returns properties that are not hardcoded into the component. Both custom and HubSpot properties. */
    additionalFieldsToSelectArray(companiesProperties) {

        return companiesProperties
            .filter((property) => !INSPECTOR_FIELDS_COMPANY.includes(property.name))
            .map((property) => {
                return { label: property.label, value: property.name };
            });
    },

    companyToLabelNameArray(companiesProperties) {

        const transformed = [];
        if (Array.isArray(companiesProperties)) {
            companiesProperties.forEach((property) => {
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

    companyToSelectArray(companiesProperties) {

        const transformed = [];
        if (Array.isArray(companiesProperties)) {
            companiesProperties.forEach((property) => {
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
