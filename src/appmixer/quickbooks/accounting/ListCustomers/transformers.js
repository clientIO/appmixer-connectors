'use strict';

/**
 * Transformer for users in workspace
 * @param {Object|string} customers
 */
module.exports.customersToSelectArray = customers => {
    if (!Array.isArray(customers?.items)) {
        return [];
    }

    return customers.items.map(customer => ({
        label: customer['DisplayName'],
        value: customer['Id']
    }));
};
