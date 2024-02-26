'use strict';

/**
 *@param {Object|string} emails
 */
module.exports.emailsToSelectArray = emails => {

    let transformed = [];

    if (Array.isArray(emails)) {
        emails.forEach(email => {
            let item = {
                label: email.snippet,
                value: email.id
            };
            transformed.push(item);
        });
    }
    return transformed;
};
