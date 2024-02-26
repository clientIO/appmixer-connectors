'use strict';
const Plivo = require('plivo');

module.exports = {

    receive(context) {

        const webhookData = context.messages.webhook;
        if (webhookData) {
            return context.sendJson(webhookData.content.data, 'completed');
        }

        const { phoneNumber } = context.messages.call.content;
        const response = Plivo.Response();
        response.addDial({
            action: context.getWebhookUrl(),
            redirect: true
        }).addNumber(phoneNumber);

        return context.response(response.toXML(), 200, { 'Content-Type': 'text/xml' });
    }
};
