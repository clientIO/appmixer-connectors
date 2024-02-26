'use strict';

const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

module.exports = {

    receive(context) {

        const response = new VoiceResponse();
        response.reject();
        return context.response(response.toString(), 200, { 'Content-Type': 'text/xml' });
    }
};
