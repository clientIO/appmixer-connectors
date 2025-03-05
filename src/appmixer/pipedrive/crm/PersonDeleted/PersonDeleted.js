'use strict';

const commons = require('../../pipedrive-commons');

module.exports = {
    async start(context) {
        await commons.registerWebhook(context, 'deleted', 'person');
    },

    async stop(context) {
        await commons.unregisterWebhook(context);
    },

    async receive(context) {
        const { data } = context.messages.webhook.content;
       
        if (data && data.meta && data.meta.action === 'deleted' && data.meta.object === 'person') {
            await context.sendJson(data.previous, 'out');
            return context.response();
        }
    }
};
