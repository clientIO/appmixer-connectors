'use strict';
const twilio = require('twilio');

module.exports = {

    receive(context) {

        if (context.messages.webhook) {
            return context.sendJson(context.messages.webhook.content.data, 'call');
        }

        let { accountSID, authenticationToken } = context.auth;
        let { from, to } = context.messages.in.content;
        let client = twilio(accountSID, authenticationToken);

        return client.calls.create({
            url: context.getWebhookUrl(),
            to: to,
            from: from
        });
    }
};
