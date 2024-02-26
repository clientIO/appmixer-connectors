'use strict';

/**
 * Transformer for categories
 * @param {Object|string} categories
 */
module.exports.categoriesToSelectArray = categories => {

    let transformed = [];

    if (Array.isArray(categories)) {
        categories.forEach(category => {

            transformed.push({
                label: category['name'],
                value: category['id']
            });
        });
    }

    return transformed;
};
