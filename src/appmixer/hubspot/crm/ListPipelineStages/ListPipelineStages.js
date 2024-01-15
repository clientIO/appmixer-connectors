'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const {
            pipelineId
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const objectType = 'deals';

        await context.log({
            step: 'request',
            accessToken: auth.accessToken,
            url: `crm/v3/pipelines/${objectType}/${pipelineId}/stages`
        });

        const { data } = await hs.call('get', `crm/v3/pipelines/${objectType}/${pipelineId}/stages`);

        return context.sendJson({ stages: data.results }, 'out');
    },

    toSelectArray({ stages }) {

        return stages.map(s => ({ label: s.label, value: s.id }));
    }
};
