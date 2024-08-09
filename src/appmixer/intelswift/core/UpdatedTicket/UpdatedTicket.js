'use strict';

module.exports = {

    async start(context) {

        const tenantId = context.profileInfo.tenantId;

        context.log({ stage: 'profile info', info: context.profileInfo, tenantId });

        return context.addListener(tenantId, { eventName: 'ticket_updated' });
    },

    async stop(context) {

        const tenantId = context.profileInfo.tenantId;

        return context.removeListener(tenantId);
    },

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'out');
        }
    }
};
