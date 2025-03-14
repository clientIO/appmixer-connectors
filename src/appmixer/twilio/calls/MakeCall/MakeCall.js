'use strict';

const twilio = require('twilio');

module.exports = {
    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'call');
            return context.response();
        }

        const { accountSID, authenticationToken } = context.auth;
        const { from, to } = context.messages.in.content;
        const client = twilio(accountSID, authenticationToken);
        const endpoint = context.getWebhookUrl();
        await client.calls.create({
            statusCallback: endpoint,
            statusCallbackEvent: ["initiated", "answered"],
            statusCallbackMethod: "POST",
            url: endpoint,
            to,
            from
        });
    }
};
