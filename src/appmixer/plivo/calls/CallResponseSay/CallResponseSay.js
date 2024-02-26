'use strict';
const Plivo = require('plivo');

module.exports = {

    receive(context) {

        const webhookData = context.messages.webhook;
        if (webhookData) {
            return context.sendJson(webhookData.content.data, 'out');
        }

        const { voice = 'en-US', language = 'WOMAN', loop = 1, text, hangup } = context.messages.call.content;
        const response = Plivo.Response();

        response.addSpeak(text, { voice, language, loop });
        if (hangup) {
            response.addHangup();
        } else {
            response.addRedirect(context.getWebhookUrl());
        }
        return context.response(response.toXML(), 200, { 'Content-Type': 'text/xml' });
    }
};
