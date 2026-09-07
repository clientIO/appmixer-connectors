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
        if (data?.meta && data.meta.action === 'create' && data.meta.entity === 'person') {
            await context.sendJson(data.data, 'out');
            return context.response();
        }
    },

    async test(context) {
        // Newest-created person reshaped into the body receive() emits (data.data).
        const person = await commons.fetchLatestPerson(context, 'add_time');
        if (!person) {
            throw new Error('No person available to use as test data.');
        }
        return context.sendJson(person, 'out');
    }
};
