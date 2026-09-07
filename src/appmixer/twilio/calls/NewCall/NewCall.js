'use strict';

module.exports = {

    async receive(context) {

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
            await context.sendJson(context.messages.webhook.content.data, 'call');
            return context.response();
        }
    },

    // No fetchable example: NewCall emits Twilio's inbound voice callback request
    // ("A Call Comes In" webhook). Twilio exposes no API that returns a past
    // call-event payload in the same parameter shape, so throw and let Flow Test
    // Mode fall through to the log/schema fallbacks.
    async test(context) {

        throw new context.CancelError(
            'NewCall can only be tested by placing a real call to your Twilio number — there is no API to fetch a past inbound-call webhook payload.'
        );
    }
};
