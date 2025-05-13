'use strict';
const lib = require('../../lib');

/**
 * Component for fetching a user by login (username).
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { user } = context.properties;
        const data = await lib.apiRequest(context, `users/${user}`);
        return context.sendJson(data.data, 'out');
    }
};
