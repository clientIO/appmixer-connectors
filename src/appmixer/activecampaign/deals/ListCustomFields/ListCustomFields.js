'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        const { data } = await ac.call('get', 'dealCustomFieldMeta');

        return context.sendJson({ fields: data.dealCustomFieldMeta || [] }, 'out');
    },

    fieldsToSelectArray({ fields }) {

        return fields.map(field => {
            return { label: field.fieldLabel, value: field.id };
        });
    }
};
