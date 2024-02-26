'use strict';
const commons = require('../../shopify-commons');

/**
 * List all customers.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);

        const params = {
            limit: 50
        };
        const customers = await commons.pager({
            shopify,
            target: 'customer',
            operation: 'list',
            params
        });
        return context.sendJson(customers, 'customers');
    },

    customersToSelectArray(customers) {

        if (customers && Array.isArray(customers)) {
            return customers.map(customer => {
                let label = `${customer.first_name} ${customer.last_name}`;
                if (!customer.first_name && !customer.last_name) {
                    label = customer.email;
                }

                return {
                    label,
                    value: customer.id
                };
            });
        }
        return [];
    }
};
