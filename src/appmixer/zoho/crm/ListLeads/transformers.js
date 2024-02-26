'use strict';

/**
 * Transformer for leads in account
 * @param {Array} leads
 */
module.exports.leadsToSelectArray = leads => {

    let transformed = [];

    if (Array.isArray(leads)) {
        leads.forEach(lead => {

            transformed.push({
                label: lead['FL'][3]['content'],
                value: lead['FL'][0]['content']
            });
        });
    }

    return transformed;
};
