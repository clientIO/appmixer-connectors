'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');

/**
 * Component for fetching a user.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const data = await commons.makeRequest({
            query: queries.getUser,
            options: {
                variables: { id: +(context.messages.in.content.userId) }
            },
            apiKey: context.auth.apiKey
        });
        const user = data.users[0] || {};
        return context.sendJson(user, 'out');
    }
};

