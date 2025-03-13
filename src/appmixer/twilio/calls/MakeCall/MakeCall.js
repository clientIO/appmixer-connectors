'use strict';

const twilio = require('twilio');

module.exports = {
    async receive(context) {

        if (context.messages.webhook) {
            return context.sendJson(context.messages.webhook.content.data, 'call');
        }

        const { accountSID, authenticationToken } = context.auth;
        const { from, to } = context.messages.in.content;
        const client = twilio(accountSID, authenticationToken);

        await client.calls.create({
            statusCallback: context.getWebhookUrl(),
            statusCallbackEvent: [
                'completed', 'busy',
                'failed', 'no-answer', 'canceled'
            ],
            url: context.getWebhookUrl(),
            to,
            from
        });
    }
};
