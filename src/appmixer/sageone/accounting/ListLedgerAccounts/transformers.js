'use strict';

/**
 * Transformer for accounts in account
 * @param {Object|string} ledgerAccounts
 */
module.exports.ledgerAccountsForSalesToSelectArray = ledgerAccounts => {

    let transformed = [];

    if (Array.isArray(ledgerAccounts)) {
        ledgerAccounts.forEach(ledgerAccount => {
            if (ledgerAccount['nominal_code'] >= 4000 && ledgerAccount['nominal_code'] < 5000) {
                transformed.push({
                    label: ledgerAccount['name'],
                    value: ledgerAccount['id']
                });
            }
        });
    }

    return transformed;
};

/**
 * Transformer for accounts in account
 * @param {Object|string} ledgerAccounts
 */
module.exports.ledgerAccountsForPurchaseToSelectArray = ledgerAccounts => {

    let transformed = [];

    if (Array.isArray(ledgerAccounts)) {
        ledgerAccounts.forEach(ledgerAccount => {
            if (ledgerAccount['nominal_code'] >= 5000 && ledgerAccount['nominal_code'] < 7000 || ledgerAccount['nominal_code'] === 1) {
                transformed.push({
                    label: ledgerAccount['name'],
                    value: ledgerAccount['id']
                });
            } else if (ledgerAccount['nominal_code'] >= 7100 && ledgerAccount['nominal_code'] <= 8900) {
                transformed.push({
                    label: ledgerAccount['name'],
                    value: ledgerAccount['id']
                });
            }
        });
    }

    return transformed;
};
