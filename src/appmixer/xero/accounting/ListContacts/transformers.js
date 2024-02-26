'use strict';

/**
 * @param {Object|string} contacts
 */
module.exports.contactsToSelectArray = contacts => {

    let transformed = [];

    if (Array.isArray(contacts)) {
        contacts.forEach(contact => {

            transformed.push({
                label: contact['Name'],
                value: contact['ContactID']
            });
        });
    }

    return transformed;
};
