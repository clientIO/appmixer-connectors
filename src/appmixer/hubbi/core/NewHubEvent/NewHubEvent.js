'use strict';

const lib = require('../../lib');

module.exports = {

    // HubBI has no API to register a webhook, so start() cannot subscribe. Instead the trigger
    // surfaces a read-only Webhook URL that the user copies into HubBI's own configuration; here
    // we only record it in state.
    async start(context) {
        await context.saveState({ webhookUrl: context.getWebhookUrl() });
    },

    async receive(context) {

        // Dynamic inspector: expose the read-only Webhook URL for the user to copy into HubBI.
        if (context.properties.generateInspector) {
            return context.sendJson({
                inputs: {
                    webhookUrl: {
                        type: 'text',
                        label: 'Webhook URL',
                        readonly: true,
                        defaultValue: context.getWebhookUrl(),
                        tooltip: 'HubBI cannot register webhooks automatically. Copy this URL into your HubBI hub configuration so HubBI posts events here.'
                    }
                }
            }, 'out');
        }

        // Dynamic output port options built from the hub's target field definitions. Unlike the
        // List helpers (whose options come from a static schema and can set ignoreAuth=true), this
        // path genuinely calls TargetFields and needs context.auth — so the source is left
        // authenticated. Degrade to a generic option if the fields can't be fetched yet.
        if (context.properties.generateOutputPortOptions) {
            const conversionKey = context.properties.conversionKey;
            const keyPicked = conversionKey && conversionKey.toString().indexOf('{{') === -1;
            let fields = [];
            if (keyPicked) {
                try {
                    fields = await lib.getFields(context, lib.ENDPOINTS.targetFields, conversionKey);
                } catch (err) {
                    await context.log({ step: 'Could not load target fields for output port options', message: err.message });
                }
            }
            return context.sendJson(lib.fieldsToOutPortOptions(fields), 'out');
        }

        // Incoming webhook event from HubBI.
        if (context.messages.webhook) {

            const { data } = context.messages.webhook.content;
            const event = data || {};
            const configuredKey = context.properties.conversionKey;
            const eventKey = event.conversionKey || event.ConversionKey;
            const records = event.records || event.Records || (Array.isArray(event) ? event : []);

            // Acknowledge (but do not emit) events for a different hub or with no records.
            if (configuredKey && eventKey && eventKey !== configuredKey) {
                await context.log({ step: 'Ignored event for a different hub', eventKey, configuredKey });
                return context.response();
            }
            if (!Array.isArray(records) || records.length === 0) {
                await context.log({ step: 'Ignored empty event', eventKey });
                return context.response();
            }

            for (const record of records) {
                await context.sendJson(record, 'out');
            }
            return context.response();
        }
    },

    // Flow Test Mode: HubBI exposes no endpoint for past events, so synthesize a sample record
    // from the hub's target field definitions (one fixed value per mapped type).
    async test(context) {

        const conversionKey = context.properties.conversionKey;
        if (!conversionKey) {
            throw new context.CancelError('Select a hub before testing.');
        }

        const fields = await lib.getFields(context, lib.ENDPOINTS.targetFields, conversionKey);
        if (!fields.length) {
            throw new context.CancelError('The selected hub has no target fields to synthesize a test record from.');
        }

        return context.sendJson(lib.synthesizeRecord(fields), 'out');
    }
};
