'use strict';
const commons = require('../../lib');

/**
 * This trigger fires when an inventory level is updated on Shopify (e.g. for low-stock alerts).
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'inventory_levels/update');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'inventoryLevel');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    },

    async test(context) {

        const record = await commons.fetchLatestInventoryLevelExample(context, 'inventory_levels/update');
        if (!record) {
            throw new Error('No inventory levels to use as test data.');
        }
        return context.sendJson(record, 'inventoryLevel');
    }
};
