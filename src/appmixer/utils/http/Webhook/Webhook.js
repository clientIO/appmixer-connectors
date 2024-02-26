'use strict';

/**
 * This component is used to trigger flows (through trigger port). The other ports
 * can be used to pair request - response of the flow.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const immediateResponseTooltip = [
            'Set to false if you use the response input port and',
            'want to send a response that you receive on the receive input port.'
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
            }, 'trigger');
        }

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content, 'trigger');
            if (context.properties.immediateResponse) {
                return context.response(context.messages.webhook.content.data);
            }
            return;
        }

        return context.response(context.messages.response.content);
    }
};
