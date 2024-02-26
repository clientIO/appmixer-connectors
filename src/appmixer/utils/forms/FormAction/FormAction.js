'use strict';
const uuid = require('uuid');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        if (context.properties.generateEntryOutPortOptions) {
            // Static call. Generate entry input fields for easier reference in connected components.
            // Note that the output port is not really important here. It just needs to match what we
            // have in component.json in the source/url.
            // Important note is that we can only do this if the input port inspector is configured. Also note that
            // the user may change the configuration therefore causing the variables used in the connected components
            // invalid.
            // Another note: Since there can be more components connected to the in input port,
            // we only generate the variables here if and only if all the configurations for all the ports
            // are exactly the same.
            // If they differ, there won't be any variables returned (since they might be misleading).
            // We believe this is OK since the most common use case is that there will only be one component
            // connected to the FormAction's in input port.
            const descriptor = context.flowDescriptor[context.componentId];
            const inputs = descriptor.config.transform.in || {};
            const fieldsArray = [];
            Object.keys(inputs).forEach(incomingComponentId => {
                const input = inputs[incomingComponentId];
                const incomingComponentOutPorts = Object.keys(input) || [];
                incomingComponentOutPorts.forEach(incomingComponentOutPort => {
                    const lambda = input[incomingComponentOutPort].lambda;
                    if (lambda.fields) {
                        fieldsArray.push(lambda.fields);
                    }
                });
            });
            // Now find out if there's more than one distinct value.
            const distinctFieldsArray = [...new Set(fieldsArray.map(fields => JSON.stringify(fields)))];
            // Cannot return variables as they might be misleading in other connected components or there are non.
            if (distinctFieldsArray.length !== 1) {
                return context.sendJson([], 'entry');
            }
            const fields = fieldsArray[0];
            const options = fields.ADD.map((field, index) => {
                return { label: field.label, value: 'field_' + index };
            });
            return context.sendJson(options, 'entry');
        }

        if (context.messages.webhook) {
            // Our "weblink" url was called.
            const correlationId = context.messages.webhook.correlationId;

            if (!correlationId) {
                return;
            }

            // newer version of this component uses query.inputMessageId to get the proper document from `state`.
            // for backward compatibility we search using correlationId if query.inputMessageId is missing
            const inputMessageId = context.messages.webhook.content.query.inputMessageId;
            const { message, weblink, scope } = (context.state[inputMessageId ? inputMessageId : correlationId] || {});

            if (context.messages.webhook.content.method === 'GET') {
                // Generate form and return HTML page.
                const formPage = lib.generateWebFormPage(message, weblink);
                return context.response(formPage, 200, { 'Content-Type': 'text/html' });
            }

            if (context.messages.webhook.content.method === 'POST') {
                // Form submission. Send entry to the entry output port.
                await context.sendJson(context.messages.webhook.content.data, 'entry', { scope });
                const successPage = lib.generateWebFormSuccessPage(message);
                return context.response(successPage, 200, { 'Content-Type': 'text/html' });
            }
        } else {
            // Input port in activated. Note that context.getWebhookUrl() now returns a different URL
            // that is bound to the input message.

            // Store input message under correlationId that will be available to use later when the webLink is accessed
            // (in context.messages.webhook.correlationId.
            const state = context.state;
            const inputMessageId = uuid.v4();

            let weblink = context.getWebhookUrl();
            weblink += ((~weblink.indexOf('?') ? '&' : '?') + 'inputMessageId=' + inputMessageId);

            state[inputMessageId] = {
                message: context.messages.in.content,
                scope: context.scope,
                weblink: weblink
            };
            await context.saveState(state);
            return context.sendJson({
                weblink: weblink,
                message: context.messages.in.content
            }, 'form');
        }
    }
};
