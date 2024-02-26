'use strict';

/**
 * Transformer for contractors in account
 * @param {Object|string} contractors
 */
module.exports.contractorsToSelectArray = contractors => {

    let transformed = [];

    if (Array.isArray(contractors)) {
        contractors.forEach(contractor => {
            if (contractor['contact_type']['id'] === 1) {
                transformed.push({
                    label: contractor['company_name'],
                    value: contractor['id']
                });
            }
        });
    }

    return transformed;
};


/**
 * Transformer for suppliers in account
 * @param {Object|string} suppliers
 */
module.exports.suppliersToSelectArray = suppliers => {

    let transformed = [];

    if (Array.isArray(suppliers)) {
        suppliers.forEach(supplier => {
            if (supplier['contact_type']['id'] === 2) {
                transformed.push({
                    label: supplier['company_name'],
                    value: supplier['id']
                });
            }
        });
    }

    return transformed;
};

/**
 * Transformer for contacts in account
 * @param {Object|string} contacts
 */

module.exports.contactsToSelectArray = contacts => {

    let transformed = [];

    if (Array.isArray(contacts)) {
        contacts.forEach(contact => {
            transformed.push({
                label: contact['company_name'],
                value: contact['id']
            });
        });
    }

    return transformed;
};
