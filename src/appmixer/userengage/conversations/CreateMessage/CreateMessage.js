'use strict';
const commons = require('../../userengage-commons');

/**
 * Create new chat message in UserEngage.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { apiKey } = context.auth;
        let { content, agent, user } = context.messages.message.content;
        return commons.getUserengageRequest(apiKey, 'users/' + user, 'GET')
            .then(res => {
                let data = {
                    chat: res.key,
                    user: agent,
                    content
                };
                return commons.getUserengageRequest(apiKey, 'message', 'POST', data, 'body');
            });
    }
};

