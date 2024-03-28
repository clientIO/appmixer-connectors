'use strict';
const commons = require('../../shopify-commons');

/**
 * Get an order.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);

        const locations = await shopify.location.list();
        console.log(locations);
        return context.sendJson(locations, 'out');
    }
};
