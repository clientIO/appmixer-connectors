'use strict';

/**
 * @param {Object|string} products
 */
module.exports.productsToSelectArray = products => {

    let transformed = [];

    if (Array.isArray(products)) {
        products.forEach((product) => {

            transformed.push({
                label: product.name,
                value: product.id
            });
        });
    }

    return transformed;
};
