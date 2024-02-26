'use strict';

/**
 * @param {Object|string} deals
 */
module.exports.goalsToSelectArray = (deals) => {

    var transformed = [];
    if (Array.isArray(deals)) {
        deals.forEach(deal => {

            const title = deal['expected_type'] + ' - ' +
                'stage: ' + deal['stage_id'] + ',' +
                'period: ' + deal['period'] + ',' +
                'expected: ' + deal['expected_sum'];

            transformed.push({
                label: title,
                value: deal.id
            });
        });
    }

    return transformed;
};
