'use strict';

/**
 * Transformer for tax rates in account
 * @param {Object|string} taxRates
 */
module.exports.taxRatesToSelectArray = taxRates => {

    let transformed = [];

    if (Array.isArray(taxRates)) {
        taxRates.forEach(taxRate => {

            transformed.push({
                label: taxRate['name'],
                value: taxRate['id']
            });
        });
    }

    return transformed;
};
