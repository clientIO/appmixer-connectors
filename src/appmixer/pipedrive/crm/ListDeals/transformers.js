'use strict';

/**
 * @param {Object|string} deals
 */
module.exports.dealsToSelectArray = (deals) => {

    var transformed = [];

    if (Array.isArray(deals)) {
        deals.forEach(deal => {

            transformed.push({
                label: deal.title,
                value: deal.id
            });
        });
    }

    return transformed;
};
