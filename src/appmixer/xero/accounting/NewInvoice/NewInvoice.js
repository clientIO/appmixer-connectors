'use strict';

const { webhookHandler, fetchLatestExample } = require('../../commons');

module.exports = {

    start: async function(context) {

        const { tenantId } = context.properties;
        const eventName = 'INVOICE.CREATE:' + tenantId;
        await context.log({ step: 'Registering webhook', eventName });
        return context.addListener(eventName);
    },

    stop: async function(context) {

        const { tenantId } = context.properties;
        const eventName = 'INVOICE.CREATE:' + tenantId;
        await context.log({ step: 'Unregistering webhook', eventName });
        return context.removeListener(eventName);
    },

    receive: async function(context) {

        await webhookHandler(context, '/api.xro/2.0/Invoices');

        return context.response();
    },

    test: async function(context) {

        const record = await fetchLatestExample(context, '/api.xro/2.0/Invoices');
        return context.sendJson(record, 'out');
    }
};
