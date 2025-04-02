'use strict';
const Hubspot = require('../../Hubspot');
const { getObjectProperties, WATCHED_PROPERTIES_CONTACT } = require('../../commons');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);
        const properties = await getObjectProperties(context, hs, 'contacts', 'all');

        return context.sendJson(properties, 'out');
    },

    /** Returns properties that not hardcoded into the component. Both custom and HubSpot properties. */
    additionalFieldsToSelectArray(contactsProperties) {
        return contactsProperties
            .filter((property) => property.formField)
            .filter((property) => !WATCHED_PROPERTIES_CONTACT.includes(property.name))
            .map((property) => {
                return { label: property.label, value: property.name };
            });
    },

    contactsPropertiesToContactInspector(contactsProperties) {

        let inspector = {
            inputs: {
                contactsProperties: {}
            }
        };
        if (Array.isArray(contactsProperties)) {
            let index = 1;
            contactsProperties.forEach((property) => {
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
                    inspector.inputs.contactsProperties[property.name] = field;
                }
            });
        }

        return inspector;
    }
};
