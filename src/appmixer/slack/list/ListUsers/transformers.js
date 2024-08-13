'use strict';

module.exports.usersToSelectArray = users => {

    let transformed = [];

    if (Array.isArray(users?.records)) {
        users.records.forEach(user => {

            transformed.push({
                label: user['real_name'] || user['name'],
                value: user['id']
            });
        });
    }

    return transformed;
};
