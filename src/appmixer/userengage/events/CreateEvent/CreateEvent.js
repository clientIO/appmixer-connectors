'use strict';
const commons = require('../../userengage-commons');

/**
 * Create new event in UserEngage.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const apiKey = context.auth.apiKey;
        let { eventName, client } = context.messages.eventOptions.content;
        let data = {
            name: eventName,
            client,
            timestamp: Math.round((new Date()).getTime() / 1000),
            data: {}
        };

        return commons.getUserengageRequest(apiKey, 'events', 'POST', data, 'body')
            .then(response => {
                return context.sendJson(response, 'event');
            });
    }
};

