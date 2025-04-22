'use strict';

module.exports = {

    async start(context) {

        const tenantId = context.profileInfo.tenantId;
        context.log({ stage: 'profile info', info: context, tenantId, check: "1" });
        context.log({ stage: 'profile info', info: context.profileInfo, tenantId, check: "1" });

        return context.addListener(tenantId, { eventName: 'contact_created', check: "1" });
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
