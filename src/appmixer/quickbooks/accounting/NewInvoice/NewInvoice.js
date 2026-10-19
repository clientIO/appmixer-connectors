'use strict';

const { webhookHandler, fetchLatestExample } = require('../../commons');
const ENTITY_NAME = 'Invoice';

module.exports = {

    start: async function(context) {

        const eventName = `${ENTITY_NAME}.Create`;
        await context.log({ step: 'Registering listener', eventName, realmId: context.profileInfo && context.profileInfo.companyId });
        // Register a listener so webhook events received via ../../routes.js can be routed
        // to this component by realmId. This is AuthHub-compatible (shared webhook endpoint).
        return context.addListener(eventName, { realmId: context.profileInfo.companyId });
    },

    stop: async function(context) {

        const eventName = `${ENTITY_NAME}.Create`;
        await context.log({ step: 'Unregistering listener', eventName });
        return context.removeListener(eventName);
    },

    receive: function(context) {

        return webhookHandler(context, ENTITY_NAME);
    },

    test: async function(context) {

        const record = await fetchLatestExample(context, ENTITY_NAME, 'MetaData.CreateTime');
        return context.sendJson(record, 'out');
    }
};
