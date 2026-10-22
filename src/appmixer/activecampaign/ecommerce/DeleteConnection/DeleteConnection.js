'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { connectionId } = context.messages.in.content;
        if (!connectionId) {
            throw new context.CancelError('Connection is required');
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        try {
            await ac.call('delete', `connections/${connectionId}`);
        } catch (e) {
            if (e.response?.status !== 404) {
                throw (e);
            }
        }

        return context.sendJson({}, 'out');
    }
};
