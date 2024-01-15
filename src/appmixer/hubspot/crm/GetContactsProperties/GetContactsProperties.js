'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);
        const { data } = await hs.call('get', 'crm/v3/properties/contacts');

        return context.sendJson(data.results, 'out');
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
    },

    getContactsOutput(availableFields) {

        const fields = [
            { label: 'Email', value: 'email' },
            { label: 'First Name', value: 'firstname' },
            { label: 'Last Name', value: 'lastname' },
            { label: 'Website', value: 'website' },
            { label: 'Company', value: 'company' },
            { label: 'Phone', value: 'phone' },
            { label: 'State', value: 'state' },
            { label: 'Address', value: 'address' },
            { label: 'City', value: 'city' },
            { label: 'Zip', value: 'zip' }
        ];

        // availableFields.forEach(customField => {
        //     fields.push({ label: customField.property, value: `customField_${customField.id}` });
        // });

        return fields;
    }
};
