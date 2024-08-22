/* eslint-disable camelcase */
'use strict';

module.exports = {

    async start(context) {

        const tenantId = context.profileInfo.tenantId;

        context.log({ stage: 'profile info', info: context.profileInfo, tenantId });

        return context.addListener('zapoj-xxx', { eventName: '' });
    },

    async stop(context) {

        const tenantId = context.profileInfo.tenantId;

        return context.removeListener('zapoj-xxx');
    },

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'out');
        }
    }
};
