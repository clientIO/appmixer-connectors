'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        if (context.properties.generateInspector) {
            // Static call. Return a dynamically rendered inspector.
            // This is only necessary since we want to render the webhook URL which is given to us in the
            // context.getWebhookUrl().
            // Note that the output port is not really important here. It just needs to match what we
            // have in component.json in the source/url.
            return context.sendJson({
                inputs: {
                    url: {
                        label: 'Form URL',
                        type: 'text',
                        readonly: true,
                        defaultValue: context.getWebhookUrl()
                    }
                }
            }, 'entry');
        }
        if (context.properties.generateEntryOutPortOptions) {
            // Static call. Generate entry input fields for easier reference in connected components.
            // Note that the output port is not really important here. It just needs to match what we
            // have in component.json in the source/url.
            const options = context.properties.fields.ADD.map((field, index) => {
                return { label: field.label, value: 'field_' + index };
            });
            return context.sendJson(options, 'entry');
        }

        if (context.messages.webhook) {
            // Our "Form URL" was called.
            if (context.messages.webhook.content.method === 'GET') {
                // Generate form and return HTML page.
                const formPage = lib.generateWebFormPage(context.properties, context.getWebhookUrl());
                return context.response(formPage, 200, { 'Content-Type': 'text/html' });
            } else if (context.messages.webhook.content.method === 'POST') {
                // Form submission. Send entry to the entry output port.
                await context.sendJson(context.messages.webhook.content.data, 'entry');
                const successPage = lib.generateWebFormSuccessPage(context.properties);
                return context.response(successPage, 200, { 'Content-Type': 'text/html' });
            }
        }
    }
};
