'use strict';

/**
 * Transformer for products in account
 * @param {Object|string} products
 */
module.exports.productsToSelectArray = products => {

    let transformed = [];

    if (Array.isArray(products)) {
        products.forEach(product => {

            transformed.push({
                label: product['product_code'],
                value: product['id']
            });
        });
    }

    return transformed;
};
