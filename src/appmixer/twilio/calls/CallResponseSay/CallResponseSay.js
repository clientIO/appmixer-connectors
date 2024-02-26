'use strict';

const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;


module.exports = {

    receive(context) {

        const input = context.messages.call.content;
        const response = new VoiceResponse();
        response.say({
            voice: input.voice || 'woman',
            language: input.language || 'en-US',
            loop: input.loop || 1
        }, input.say);
        return context.response(response.toString(), 200, { 'Content-Type': 'text/xml' });
    }
};
