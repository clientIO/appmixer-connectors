'use strict';
const commons = require('../../shopify-commons');

/**
 * Find customers.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);
        const { query, maxResults, sort, sendWholeArray } = context.messages.in.content;
        const customers = await shopify.customer.search({
            query,
            limit: maxResults,
            order: sort
        });

        if (sendWholeArray) {
            return context.sendJson({ customers }, 'customer');
        }

        const promises = [];
        customers.forEach(customer => {
            promises.push(context.sendJson(customer, 'customer'));
        });
        return Promise.all(promises);
    }
};
