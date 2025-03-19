'use strict';

const { makeRequest } = require('../../commons');

module.exports = {

    async start(context) {

        const { data } = await makeRequest(context, '/api/v1/accounts/account', { method: 'POST' });
        const tenantId = data?.data[0].tenantId;

        context.log({ stage: 'profile info', info: context.profileInfo, tenantId });

        return context.addListener(tenantId, { eventName: 'ticket_updated' });
    },

    async stop(context) {

        const { data } = await makeRequest(context, '/api/v1/accounts/account', { method: 'POST' });
        const tenantId = data?.data[0].tenantId;

        return context.removeListener(tenantId);
    },

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'out');
        }
    }
};
