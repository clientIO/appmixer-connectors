'use strict';

const { fetchLatestRecord } = require('../../lib');

const eventName = (context) => `${(context.auth.instance)}.${(context.properties.tableName)}.insert`;

module.exports = {

    async start(context) {

        context.log({ stage: 'start', eventName: eventName(context) });
        return context.addListener(eventName(context));
    },

    async stop(context) {

        return context.removeListener(eventName(context));
    },

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'out');
        }
    },

    async test(context) {

        const { tableName } = context.properties;
        const record = await fetchLatestRecord(context, { tableName, orderField: 'sys_created_on' });
        if (!record) {
            throw new Error(`No records in table "${tableName}" to use as test data.`);
        }
        return context.sendJson(record, 'out');
    }
};
