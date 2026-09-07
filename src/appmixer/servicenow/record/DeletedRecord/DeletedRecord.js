'use strict';

const { fetchLatestRecord } = require('../../lib');

const eventName = (context) => `${(context.auth.instance)}.${(context.properties.tableName)}.delete`;

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

        // A deleted record cannot be fetched read-only. The delete webhook payload is a snapshot
        // of the record as it existed (same shape as a Table API record and as the New/Updated
        // triggers' outPort schema). We therefore reshape the newest existing record into that
        // payload shape so Test Mode emits a real, correctly-shaped example.
        const { tableName } = context.properties;
        const record = await fetchLatestRecord(context, { tableName, orderField: 'sys_updated_on' });
        if (!record) {
            throw new Error(`No records in table "${tableName}" to use as test data.`);
        }
        return context.sendJson(record, 'out');
    }
};
