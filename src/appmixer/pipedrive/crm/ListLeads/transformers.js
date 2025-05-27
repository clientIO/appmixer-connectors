'use strict';

/**
 * @param {Object|string} leads
 */
module.exports.leadsToSelectArray = (leads) => {

    let transformed = [];

    if (Array.isArray(leads)) {
        leads.forEach((lead) => {

            transformed.push({
                label: lead.title,
                value: lead.id
            });
        });
    }

    return transformed;
};
