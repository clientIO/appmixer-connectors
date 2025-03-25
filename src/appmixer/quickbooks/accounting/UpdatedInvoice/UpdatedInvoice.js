'use strict';

const { webhookHandler } = require('../../commons');
const ENTITY_NAME = 'Invoice';

module.exports = {

    start: async function(context) {

        const { componentId, flowId } = context;
        const webhook = `${ENTITY_NAME}.Update:${context.profileInfo.companyId}`;
        await context.log({ step: 'Registering webhook', webhook });
        // Subscribe to a static webhook events received via ../../plugin.js.
        return context.service.stateAddToSet(webhook, { flowId, componentId, webhook });
    },

    stop: async function(context) {

        const { componentId, flowId } = context;
        const webhook = `${ENTITY_NAME}.Update:${context.profileInfo.companyId}`;
        await context.log({ step: 'Unregistering webhook', webhook });
        // Unsubscribe from a static webhook events received via ../../plugin.js.
        return context.service.stateRemoveFromSet(webhook, { componentId, flowId });
    },

    receive: function(context) {

        return webhookHandler(context, ENTITY_NAME);
    }
};
