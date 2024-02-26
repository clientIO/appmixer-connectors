'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const {
            contactId,
            email,
            firstName,
            lastName,
            phone,
            customFields
        } = context.messages.in.content;

        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        const payload = {
            contact: {
                email,
                firstName,
                lastName,
                phone
            }
        };

        const customFieldsValues = customFields.AND || [];
        const fieldValues = [];
        if (customFieldsValues.length > 0) {
            customFieldsValues.forEach(customField => {
                fieldValues.push({ field: customField.field, value: customField.value });
            })
            payload.contact.fieldValues = fieldValues;
        }

        const { data } = await ac.call('put', `contacts/${contactId}`, payload);

        const customFieldsPayload = data.fieldValues.reduce((acc, field) => {
            acc[`customField_${field.field}`] = field.value;
            return acc;
        }, {});

        return context.sendJson({
            id: contactId,
            email: data.contact.email,
            firstName: data.contact.firstName,
            lastName: data.contact.lastName,
            phone: data.contact.phone,
            createdDate: data.contact.cdate,
            ...customFieldsPayload
        }, 'contact');
    }
};
