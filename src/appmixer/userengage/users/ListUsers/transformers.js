'use strict';

/**
 * Transformer for users in userengage
 * @param {Object|string} users
 */
module.exports.usersToSelectArray = users => {

    let transformed = [];

    if (Array.isArray(users)) {
        users.forEach(user => {

            transformed.push({
                label: `${user['name']} (${user['email'] ? user['email'] : 'no email'})`,
                value: user['id']
            });
        });
    }

    return transformed;
};
