'use strict';

const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;


module.exports = {

    receive(context) {

        if (context.messages.webhook) {
            return context.sendJson(context.messages.webhook.content.data, 'input');
        }

        const input = context.messages.call.content;
        const response = new VoiceResponse();
        const gather = response.gather({
            input: 'speech dtmf',
            timeout: input.timeout || 5,
            numDigits: input.numDigits || 1,
            finishOnKey: input.finishOnKey || '#',
            action: context.getWebhookUrl()
        });
        gather.say({
            voice: input.voice || 'woman',
            language: input.language || 'en'
        }, input.say);

        return context.response(response.toString(), 200, { 'Content-Type': 'text/xml' });
    }
};
