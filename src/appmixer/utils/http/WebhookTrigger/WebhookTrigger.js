'use strict';

const GenerateSchema = require('generate-schema');

/**
 * This component is used to trigger flows (through trigger port). The other ports
 * can be used to pair request - response of the flow.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.properties.dataExample);
        }

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
    },

    // Flow Test Mode: a webhook has no upstream to fetch from, so emit the user-provided
    // request data example in the exact { method, data, query, headers } shape that
    // receive() forwards for a real request. Only reads the configured example — no state
    // writes, no fabricated data.
    test(context) {

        const example = context.properties.dataExample;
        if (!example) {
            throw new Error('No request data example configured to use as test data.');
        }

        let data;
        try {
            data = JSON.parse(example);
        } catch (err) {
            throw new Error('The configured request data example is not valid JSON.');
        }

        return context.sendJson({ method: 'POST', data, query: {}, headers: {} }, 'request');
    },

    // Builds the variable-picker options for the `request` port. `method`, `query` and
    // `headers` are always present; the shape of `data` is inferred from the user-provided
    // JSON example so its individual fields become referable in connected components.
    getOutputPortOptions(context, dataExample) {

        let dataSchema = { type: 'object' };
        try {
            dataSchema = GenerateSchema.json('Data', JSON.parse(dataExample));
        } catch (err) {
            // No example or invalid JSON — leave `data` as a generic object.
        }

        return context.sendJson([
            { label: 'Method', value: 'method', schema: { type: 'string' } },
            { label: 'Data', value: 'data', schema: dataSchema },
            { label: 'Query', value: 'query', schema: { type: 'object' } },
            { label: 'Headers', value: 'headers', schema: { type: 'object' } }
        ], 'request');
    }
};
