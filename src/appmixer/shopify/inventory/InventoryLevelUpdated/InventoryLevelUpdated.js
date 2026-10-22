'use strict';

const lib = require('../../lib');
const gqlStore = require('../../gql-store');

const TOPIC = 'inventory_levels/update';

/**
 * Triggers when the quantities of an inventory item at a location change.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return lib.registerWebhooks(context, [TOPIC]);
    },

    async stop(context) {

        return lib.unregisterWebhooks(context);
    },

    async receive(context) {

        if (context.messages.webhook) {
            const api = gqlStore(lib.runner(context));
            // An inventory level has no id of its own in the payload: its gid
            // (gid://shopify/InventoryLevel/1?inventory_item_id=2) comes in
            // admin_graphql_api_id; item + location identify it as well.
            const fetch = (id, payload) => api.getInventoryLevel(
                payload.admin_graphql_api_id
                    ? { id: payload.admin_graphql_api_id }
                    : { inventoryItemId: payload.inventory_item_id, locationId: payload.location_id }
            );
            return lib.receiveWebhook(context, { port: 'out', type: 'InventoryLevel', fetch });
        }
    },

    async test(context) {

        const level = await gqlStore(lib.runner(context)).latestInventoryLevel();
        if (!level) {
            throw new context.CancelError('The store has no inventory levels yet. Add a product to a location to get test data.');
        }
        return context.sendJson({ ...level, webhookTopic: TOPIC }, 'out');
    }
};
