'use strict';
const Plivo = require('plivo');

module.exports = {

    receive(context) {

        const { reason, schedule, voice = 'en-US', language = 'WOMAN', loop = 1, text } = context.messages.call.content;
        const response = Plivo.Response();

        const hangupParams = {};
        if (schedule) {
            hangupParams.schedule = schedule;
        }
        if (reason) {
            hangupParams.reason = reason;
        }

        response.addHangup(hangupParams);

        if (text) {
            response.addSpeak(text, { voice, language, loop });
        }
        return context.response(response.toXML(), 200, { 'Content-Type': 'text/xml' });
    }
};
