'use strict';

/**
 * Transformer for leads in salesforce
 * @param {Object|string} leads
 */
module.exports.leadsToSelectArray = leads => {

    let transformed = [];

    if (Array.isArray(leads)) {
        leads.forEach(lead => {

            transformed.push({
                label: lead['Name'],
                value: lead['Id']
            });
        });
    }

    return transformed;
};
