'use strict';

const commons = require('../../pipedrive-commons');

module.exports = {
    async start(context) {
        await commons.registerWebhook(context, 'change', 'person');
    },

    async stop(context) {
        await commons.unregisterWebhook(context);
    },

    async receive(context) {
        const { data } = context.messages.webhook.content;
        if (data?.meta && data.meta.action === 'change' && data.meta.entity === 'person') {
            const addTime = new Date(data.data.add_time).getTime();
            const updateTime = new Date(data.data.update_time).getTime();

            // Ignore updates that occur immediately after creation
            if (updateTime - addTime < 5000) {
                //Ignoring immediate updates as they are likely to be created by the system
                return context.response();
            }

            await context.sendJson(data.data, 'out');
        }
        return context.response();
    },

    async test(context) {
        // Newest-updated person reshaped into the body receive() emits (data.data).
        const person = await commons.fetchLatestPerson(context, 'update_time');
        if (!person) {
            throw new Error('No person available to use as test data.');
        }
        return context.sendJson(person, 'out');
    }
};
