'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const {
            dealId
        } = context.messages.in.content;

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        try {
            await ac.call('delete', `deals/${dealId}`);
        } catch (e) {
            if (e.response.status !== 404) {
                throw (e);
            }
        }

        return context.sendJson({ dealId }, 'out');
    }
};
