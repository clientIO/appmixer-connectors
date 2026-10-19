'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { stageId } = context.messages.in.content;
        if (!stageId) {
            throw new context.CancelError('Stage is required');
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        try {
            await ac.call('delete', `dealStages/${stageId}`);
        } catch (e) {
            if (e.response?.status !== 404) {
                throw (e);
            }
        }

        return context.sendJson({}, 'out');
    }
};
