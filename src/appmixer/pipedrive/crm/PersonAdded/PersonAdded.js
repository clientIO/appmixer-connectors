'use strict';

const commons = require('../../pipedrive-commons');

module.exports = {
    async start(context) {
        await commons.registerWebhook(context, 'create', 'person');
    },

    async stop(context) {
        await commons.unregisterWebhook(context);
    },

    async receive(context) {
        const { data } = context.messages.webhook.content;
        if (data && data.meta && data.meta.action === 'create' && data.meta.entity === 'person') {
            await context.sendJson(data.data, 'out');
            return context.response();
        }
    }
};
