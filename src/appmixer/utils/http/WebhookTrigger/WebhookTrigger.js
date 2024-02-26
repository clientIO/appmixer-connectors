'use strict';

/**
 * This component is used to trigger flows (through trigger port). The other ports
 * can be used to pair request - response of the flow.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const immediateResponseTooltip = [
            'If you want a customized response, set it to <b>false</b> and to define the response using the <b>Response</b> component anywhere in the flow.',
            'Once it is set to <b>true</b> you will get the response immediately, including the data you have inputted.'
        ].join(' ');
        if (context.properties.generateInspector) {
            return context.sendJson({
                inputs: {
                    url: {
                        label: 'Webhook URL',
                        type: 'text',
                        readonly: true,
                        index: 1,
                        defaultValue: context.getWebhookUrl()
                    },
                    immediateResponse: {
                        type: 'toggle',
                        label: 'Immediate response',
                        index: 2,
                        tooltip: immediateResponseTooltip,
                        defaultValue: true
                    }
                }
            }, 'request');
        }

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content, 'request');
            if (context.properties.immediateResponse) {
                return context.response(context.messages.webhook.content.data);
            }
            return;
        }

        return context.response(context.messages.response.content);
    }
};
