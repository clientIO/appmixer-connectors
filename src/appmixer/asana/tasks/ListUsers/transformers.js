'use strict';

/**
 * Transformer for users in workspace
 * @param {Object|string} users
 */
module.exports.usersToSelectArray = users => {

    let transformed = [];

    if (Array.isArray(users)) {
        users.forEach(user => {

            transformed.push({
                label: user['name'],
                value: user['gid']
            });
        });
    }

    return transformed;
};
