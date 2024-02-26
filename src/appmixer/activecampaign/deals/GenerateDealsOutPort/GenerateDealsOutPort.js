'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { auth } = context;

        const ac = new ActiveCampaign(auth.url, auth.apiKey);
        const { data } = await ac.call('get', 'dealCustomFieldMeta');

        return context.sendJson({ fields: data.dealCustomFieldMeta }, 'out');
    },

    getDealsOutput({ fields: availableFields }) {

        const fields = [
            { label: 'Deal ID', value: 'id' },
            { label: 'Contact ID', value: 'contactId' },
            { label: 'Title', value: 'title' },
            { label: 'Description', value: 'description' },
            { label: 'Deal amount', value: 'value' },
            { label: 'Currency', value: 'currency' },
            { label: 'Owner', value: 'owner' },
            { label: 'Stage', value: 'stage' },
            { label: 'Status', value: 'status' },
            { label: 'Created Datetime', value: 'createdDate' }
        ];


        availableFields.forEach(customField => {
            fields.push({ label: customField.fieldLabel, value: `customField_${customField.id}` });
        });

        return fields;
    }
};
