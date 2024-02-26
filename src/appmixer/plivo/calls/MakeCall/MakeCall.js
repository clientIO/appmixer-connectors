'use strict';
const Plivo = require('plivo');

/**
 * Component for making calls through Plivo.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        if (context.messages.webhook) {
            context.sendJson(context.messages.webhook.content.data, 'call');
            return;
        }

        let { accountSID, authenticationToken } = context.auth;
        let { from, to } = context.messages.in.content;
        let client = new Plivo.Client(accountSID, authenticationToken);

        return client.calls.create(from, to, context.getWebhookUrl());
    }
};
