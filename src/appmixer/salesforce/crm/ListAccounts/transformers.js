'use strict';

/**
 * Transformer for accounts in salesforce
 * @param {Object|string} accounts
 */
module.exports.accountsToSelectArray = accounts => {

    let transformed = [];

    if (Array.isArray(accounts)) {
        accounts.forEach(account => {

            transformed.push({
                label: account['Name'],
                value: account['Id']
            });
        });
    }

    return transformed;
};
