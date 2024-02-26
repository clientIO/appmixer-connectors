'use strict';

const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;


module.exports = {

    receive(context) {

        if (context.messages.webhook) {
            return context.sendJson(context.messages.webhook.content.data, 'completed');
        }

        const input = context.messages.call.content;
        const response = new VoiceResponse();
        const dial = response.dial({
            action: context.getWebhookUrl()
        });
        dial.number(input.phoneNumber);
        return context.response(response.toString(), 200, { 'Content-Type': 'text/xml' });
    }
};
