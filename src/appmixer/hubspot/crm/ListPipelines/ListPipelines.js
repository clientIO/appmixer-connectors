'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const {
            objectType
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const { data } = await hs.call('get', `crm/v3/pipelines/${objectType}`);

        return context.sendJson({ pipelines: data.results }, 'out');
    },

    toSelectArray({ pipelines }) {

        return pipelines.map(p => ({ label: p.label, value: p.id }));
    }
};
