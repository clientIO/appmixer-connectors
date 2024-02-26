'use strict';

/**
 * Transformer for users in site
 * @param {Object|string} users
 */
module.exports.usersToSelectArray = users => {

    let transformed = [];

    if (Array.isArray(users)) {
        users.forEach(user => {
            transformed.push({
                label: user['email'],
                value: user['ID']
            });
        });
    }

    return transformed;
};
