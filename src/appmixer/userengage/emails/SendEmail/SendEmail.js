'use strict';
const commons = require('../../userengage-commons');

/**
 * Send email in UserEngage.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let apiKey = context.auth.apiKey;
        let { subject, content, receiver, template, agent } = context.messages.email.content;
        let data = {
            subject,
            content,
            receivers: receiver,
            template,
            email: agent
        };

        return commons.getUserengageRequest(apiKey, 'emails/send', 'POST', data, 'body');
    }
};

