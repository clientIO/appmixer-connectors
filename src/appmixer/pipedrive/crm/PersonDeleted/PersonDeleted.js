'use strict';

const commons = require('../../pipedrive-commons');

module.exports = {
    async start(context) {
        await commons.registerWebhook(context, 'delete', 'person');
    },

    async stop(context) {
        await commons.unregisterWebhook(context);
    },

    async receive(context) {
        const { data } = context.messages.webhook.content;
        if (data?.meta && data.meta.action === 'delete' && data.meta.entity === 'person') {
            await context.sendJson(data.previous, 'out');
            return context.response();
        }
    },

    async test(context) {
        // On delete the webhook delivers the prior person data (data.previous), which
        // is a bare person object with the same shape as a live person. Use the newest
        // existing person as that representative previous-state payload.
        const person = await commons.fetchLatestPerson(context, 'add_time');
        if (!person) {
            throw new Error('No person available to use as test data.');
        }
        return context.sendJson(person, 'out');
    }
};
