'use strict';
const commons = require('../../shopify-commons');

/**
 * List all products.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);

        const params = {
            limit: 50
        };
        const products = await commons.pager({
            shopify,
            target: 'product',
            operation: 'list',
            params
        });
        return context.sendJson(products, 'products');
    },

    productsToSelectArray(products) {

        if (products && Array.isArray(products)) {
            return products.map(product => ({
                label: product.title,
                value: product.id
            }));
        }
        return [];
    },

    variantsToSelectArray(products) {

        if (products && Array.isArray(products)) {
            const variants = [];
            products.forEach(product => {
                product.variants.forEach(variant => {
                    const { id, title } = variant;
                    variants.push({
                        value: id,
                        label: title === 'Default Title' ? product.title : `${product.title} - ${title}`
                    });
                });
            });

            return variants;
        }
        return [];
    }
};
