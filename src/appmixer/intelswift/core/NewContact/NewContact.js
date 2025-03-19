'use strict';

module.exports = {

    async start(context) {

        const { data } = await makeRequest(context, '/api/v1/accounts/account', { method: 'POST' });
        const tenantId = data?.data[0].tenantId;

        context.log({ stage: 'profile info', info: context, tenantId, check: "1" });

        return context.addListener(tenantId, { eventName: 'contact_created', check: "1" });
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
