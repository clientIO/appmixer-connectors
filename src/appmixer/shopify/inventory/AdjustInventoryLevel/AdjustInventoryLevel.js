'use strict';
const commons = require('../../shopify-commons');

/**
 * Get an order.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);

        const locations = await shopify.inventoryLevel.adjust({
            inventory_item_id: 9194129555616,
            location_id: 48167288992,
            available: 10
        });
        console.log(locations);
        return context.sendJson(locations, 'out');
    }
};
