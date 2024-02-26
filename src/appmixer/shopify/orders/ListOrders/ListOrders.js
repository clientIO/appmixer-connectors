'use strict';
const commons = require('../../shopify-commons');

/**
 * List all orders.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);
        const params = {
            limit: 50
        };

        const orders = await commons.pager({
            shopify,
            target: 'order',
            operation: 'list',
            params
        });
        return context.sendJson(orders, 'orders');
    },

    ordersToSelectArray(orders) {

        if (orders && Array.isArray(orders)) {
            return orders.map(order => ({
                label: order.name,
                value: order.id
            }));
        }
        return [];
    }
};
