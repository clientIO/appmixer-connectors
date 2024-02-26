'use strict';

/**
 * Transformer for person in contacts
 * @param {Object|string} contacts
 */
module.exports.contactsToSelectArray = contacts => {

    let transformed = [];

    if (Array.isArray(contacts)) {
        contacts.forEach(person => {

            transformed.push({
                label: person['first_name'] + ' ' + person['last_name'],
                value: person['id']
            });
        });
    }

    return transformed;
};
