'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        const { data } = await ac.call('get', 'fields');

        return context.sendJson({ fields: data.fields || [] }, 'out');
    },

    fieldsToSelectArray({ fields }) {

        return fields.map(field => {
            return { label: field.title, value: field.id };
        });
    }
};
