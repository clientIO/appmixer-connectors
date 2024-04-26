'use strict';

const { webhookHandler } = require('../../commons');

module.exports = {

    start: async function(context) {

        const { tenantId } = context.properties;
        const { componentId, flowId } = context;
        const webhook = 'INVOICE.UPDATE:' + tenantId;
        await context.log({ step: 'Registering webhook', webhook });
        // Subscribe to a static webhook events received via ../../plugin.js.
        return context.service.stateAddToSet(webhook, { flowId, componentId, webhook });
    },

    stop: async function(context) {

        const { tenantId } = context.properties;
        const { componentId, flowId } = context;
        const webhook = 'INVOICE.UPDATE:' + tenantId;
        await context.log({ step: 'Unregistering webhook', flowId, componentId, webhook });
        // Unsubscribe from a static webhook events received via ../../plugin.js.
        return context.service.stateRemoveFromSet(webhook, { componentId, flowId });
    },

    receive: async function(context) {

        await webhookHandler(context, '/api.xro/2.0/Invoices');

        return context.response();
    }
};
