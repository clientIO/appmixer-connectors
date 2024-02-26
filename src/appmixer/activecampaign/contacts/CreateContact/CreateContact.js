'use strict';
const moment = require('moment');
const { trimUndefined } = require('../../helpers');
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const {
            email,
            firstName,
            lastName,
            phone,
            customFields = {}
        } = context.messages.in.content;

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        const payload = {
            contact: trimUndefined(
                {
                    email,
                    firstName,
                    lastName,
                    phone
                }
            )
        };

        const customFieldsValues = customFields.AND || [];
        const fieldValues = [];
        if (customFieldsValues.length > 0) {
            customFieldsValues.forEach(customField => {
                fieldValues.push({ field: customField.field, value: customField.value });
            })
            payload.contact.fieldValues = fieldValues;
        }

        const { data } = await ac.call('post', 'contacts', payload);
        const { contact } = data;

        const customFieldsPayload = fieldValues.reduce((acc, field) => {
            acc[`customField_${field.field}`] = field.value;
            return acc;
        }, {});

        return context.sendJson({
            id: contact.id,
            email: contact.email,
            firstName: contact.firstName,
            lastName: contact.lastName,
            phone: contact.phone,
            createdDate: moment(contact.cdate).toISOString(),
            ...customFieldsPayload
        }, 'contact');
    }
};
