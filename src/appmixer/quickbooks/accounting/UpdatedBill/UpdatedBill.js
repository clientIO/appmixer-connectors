'use strict';

const { webhookHandler, fetchLatestExample } = require('../../commons');
const ENTITY_NAME = 'Bill';

module.exports = {

    start: async function(context) {

        const eventName = `${ENTITY_NAME}.Update`;
        await context.log({ step: 'Registering listener', eventName, realmId: context.profileInfo && context.profileInfo.companyId });
        return context.addListener(eventName, { realmId: context.profileInfo.companyId });
    },

    stop: async function(context) {

        const eventName = `${ENTITY_NAME}.Update`;
        await context.log({ step: 'Unregistering listener', eventName });
        return context.removeListener(eventName);
    },

    receive: function(context) {

        return webhookHandler(context, ENTITY_NAME);
    },

    test: async function(context) {

        const record = await fetchLatestExample(context, ENTITY_NAME, 'MetaData.LastUpdatedTime');
        return context.sendJson(record, 'out');
    }
};
