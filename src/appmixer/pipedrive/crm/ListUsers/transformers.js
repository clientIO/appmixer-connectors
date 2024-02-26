'use strict';

/**
 * @param {Object|string} users
 * @param {Object} message.data
 */
module.exports.usersToSelectArray = (users) => {

    var transformed = [];

    if (Array.isArray(users)) {
        users.forEach((user) => {

            transformed.push({
                label: user.name,
                value: user.id
            });
        });
    }

    return transformed;
};
