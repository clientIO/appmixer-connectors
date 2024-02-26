'use strict';

/**
 * @param {Object|string} companies
 */
module.exports.companiesToSelectArray = companies => {

    let transformed = [];

    if (Array.isArray(companies)) {
        companies.forEach(company => {

            transformed.push({
                label: company['name'],
                value: company['id']
            });
        });
    }

    return transformed;
};
