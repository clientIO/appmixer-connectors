'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { pipelineId } = context.messages.in.content;
        if (!pipelineId) {
            throw new context.CancelError('Pipeline is required');
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        try {
            await ac.call('delete', `dealGroups/${pipelineId}`);
        } catch (e) {
            if (e.response?.status !== 404) {
                throw (e);
            }
        }

        return context.sendJson({}, 'out');
    }
};
