'use strict';
const Plivo = require('plivo');

module.exports = {

    receive(context) {

        const webhookData = context.messages.webhook;
        if (webhookData) {
            return context.sendJson(webhookData.content.data, 'input');
        }

        const {
            numDigits = 1,
            finishOnKey = '#',
            voice = 'en-US',
            language = 'WOMAN',
            timeout = 15,
            loop = 1,
            text
        } = context.messages.call.content;

        const response = Plivo.Response();
        const getDigits = response.addGetDigits({
            action: context.getWebhookUrl(),
            timeout,
            numDigits,
            finishOnKey
        });

        if (text && text !== '') {
            getDigits.addSpeak(text, { voice, language, loop });
        }

        // UNCOMENT IF NEEDED - in case of failed user input (digits not entered during timeout)
        // response.addSpeak({ voice, language }, 'Input not received. Thank you');

        return context.response(response.toXML(), 200, { 'Content-Type': 'text/xml' });
    }
};
