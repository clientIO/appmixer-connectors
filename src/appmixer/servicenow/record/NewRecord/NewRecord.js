/* eslint-disable camelcase */
'use strict';

module.exports = {

    async start(context) {

        const tableName = context.properties.tableName;
        context.log({ stage: 'start', name: `${tableName}.insert` });
        return context.addListener(`${tableName}.insert`);
    },

    async stop(context) {

        const tableName = context.properties.tableName;
        return context.removeListener(`${tableName}.insert`);
    },

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'out');
        }
    }
};
