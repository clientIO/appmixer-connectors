'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { auth } = context;

        const ac = new ActiveCampaign(auth.url, auth.apiKey);
        const { data } = await ac.call('get', 'fields');

        return context.sendJson({ fields: data.fields }, 'out');
    },

    getContactsOutput({ fields: availableFields }) {

        const fields = [
            { label: 'Contact ID', value: 'id' },
            { label: 'Email', value: 'email' },
            { label: 'First name', value: 'firstName' },
            { label: 'Last name', value: 'lastName' },
            { label: 'Phone', value: 'phone' },
            { label: 'Created Datetime', value: 'createdDate' }
        ];

        availableFields.forEach(customField => {
            fields.push({ label: customField.title, value: `customField_${customField.id}` });
        });

        return fields;
    }
};
