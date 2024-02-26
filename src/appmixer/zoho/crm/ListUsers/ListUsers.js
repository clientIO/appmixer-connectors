'use strict';
const ZohoClient = require('../../ZohoClient');

/**
 * Component for fetching list of users.
 */
module.exports = {

    async receive(context) {

        const zc = new ZohoClient(context);

        const users = await zc.requestPaginated('GET', '/crm/v2/users', {
            dataKey: 'users',
            params: { type: 'ActiveUsers' }
        });
        return context.sendJson(users, 'users');
    },

    /**
     * Transformer for users.
     * @param {Object} users
     */
    usersToSelectArray(users) {

        let transformed = [];

        if (Array.isArray(users)) {
            users.forEach(user => {
                transformed.push({
                    content: user.full_name + ' <' + user.email + '>',
                    value: user.id
                });
            });
        }

        return transformed;
    }
};
