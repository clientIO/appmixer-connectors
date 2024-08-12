'use strict';

module.exports.usersToSelectArray = users => {

    let transformed = [];

    if (Array.isArray(users)) {
        users.forEach(user => {

            transformed.push({
                label: user['real_name'],
                value: user['id']
            });
        });
    }

    return transformed;
};
