'use strict';

module.exports = {

    receive(context) {

        if (context.properties.generateInspector) {
            // Trick to return dynamic inspector from within receive().
            return context.sendJson({
                inputs: {
                    url: {
                        label: 'Callback URL',
                        type: 'text',
                        readonly: true,
                        defaultValue: context.getWebhookUrl(),
                        tooltip: 'Go to the Phone Numbers manager page in Twilio and paste the Callback URL as a Webhook to the "A Call Comes In" field of the Voice & Fax section.'
                    }
                }
            }, 'call');

        } else if (context.messages.webhook) {
            // Twilio HTTP callback request.
            return context.sendJson(context.messages.webhook.content.data, 'call');
        }
    }
};
