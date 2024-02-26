'use strict';
const commons = require('../../userengage-commons');

/**
 * Component for fetching list of conversations
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { apiKey } = context.auth;

        return commons.getUserengageRequest(apiKey, 'channels', 'GET')
            .then(conversations => {
                return context.sendJson(conversations.results, 'conversations');
            });
    }
};

