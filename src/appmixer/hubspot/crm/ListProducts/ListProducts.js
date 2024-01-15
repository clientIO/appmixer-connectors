'use strict';
const HubSpot = require('../../Hubspot');

/**
 * Component for fetching list of products.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { auth } = context;
        const hubSpot = new HubSpot(auth.accessToken, context.config);
        const { data } = await  hubSpot.call('get', 'crm/v3/objects/products', {}, { query: 'limit=100' });
        return context.sendJson(data.results, 'out');
    },

    productsToSelectArray(products) {

        let transformed = [];

        if (Array.isArray(products)) {
            products.forEach(product => {
                transformed.push({
                    label: `${product.properties.name}`,
                    value: product.id.toString()
                });
            });
        }

        return transformed;
    }
};
