'use strict';

/**
 * @param {Object|string} currencies
 */
module.exports.currenciesToSelectArray = currencies => {

    let transformed = [];

    if (Array.isArray(currencies)) {
        currencies.forEach((currency) => {

            transformed.push({
                label: currency.code,
                value: currency.code
            });
        });
    }

    return transformed;
};
