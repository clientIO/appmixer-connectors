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
                const data = Object.assign({}, context.messages.webhook.content.data);
                const fields = (context.properties.fields && context.properties.fields.ADD) || [];
                fields.forEach((field, index) => {
                    if (field.type === 'checkbox') {
                        const name = 'field_' + index;
                        data[name] = data[name] === 'on';
                    }
                });
                await context.sendJson(data, 'entry');
                const successPage = lib.generateWebFormSuccessPage(context.properties);
                return context.response(successPage, 200, { 'Content-Type': 'text/html' });
            }
        }
    },

    // Flow Test Mode: emit one plausible form entry without waiting for a real submission.
    // Mirrors what a POST submission produces: keys are 'field_<index>', values are strings
    // (HTML forms submit strings) except checkbox, which receive() normalizes to a boolean.
    // Prefers the field's configured defaultValue for realism.
    test(context) {

        const fields = (context.properties.fields && context.properties.fields.ADD) || [];
        if (!fields.length) {
            throw new Error('No form fields defined.');
        }

        const entry = {};
        fields.forEach((field, index) => {
            const name = 'field_' + index;
            if (field.type === 'checkbox') {
                entry[name] = true;
                return;
            }
            if (field.defaultValue) {
                entry[name] = field.defaultValue;
                return;
            }
            switch (field.type) {
                case 'number': entry[name] = '42'; break;
                case 'date': entry[name] = '2026-01-01'; break;
                case 'email': entry[name] = 'user@example.com'; break;
                case 'color': entry[name] = '#336699'; break;
                case 'password': entry[name] = 'secret'; break;
                default: entry[name] = field.label || 'Sample text';
            }
        });

        return context.sendJson(entry, 'entry');
    }
};
