'use strict';

/**
 * Transformer for company in account
 * @param {Object|string} companies
 */
module.exports.companyNamesToSelectArray = companies => {

    let transformed = [];

    if (Array.isArray(companies)) {
        companies.forEach(company => {

            let getCompanyName = company['app_href'].match(/[\w]+/g)[1];

            transformed.push({
                label: getCompanyName,
                value: getCompanyName
            });
        });
    }

    return transformed;
};
