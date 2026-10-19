'use strict';

const lib = require('../../lib');

const WEBHOOK_URL_TOOLTIP = 'Emarsys cannot register webhooks through its API. Copy this URL into an Automation '
    + 'Center webhook node preset (Automation > Webhook Node Presets), then build an audience-based program with '
    + 'the "New Contact" entry point, a short wait, and that webhook node. Send at least <code>contact_id</code> '
    + 'and <code>email</code> as contact data. Pause the Emarsys program before you stop this flow, otherwise the '
    + 'program drops into fail-safe mode after repeated delivery failures.';

module.exports = {

    // There is nothing to subscribe to — the user wires the webhook node by hand — so start() only
    // records the URL that the Emarsys preset is expected to point at. Nothing reads it back; it
    // exists so the component's state shows which URL this instance handed out when a delivery
    // does not arrive.
    async start(context) {
        await context.saveState({ webhookUrl: context.getWebhookUrl() });
    },

    async receive(context) {

        // Dynamic inspector: surface the read-only Webhook URL for the user to copy into Emarsys.
        if (context.properties.generateInspector) {
            return context.sendJson(lib.webhookUrlInspector(context, WEBHOOK_URL_TOOLTIP), 'out');
        }

        if (context.messages.webhook) {
            return lib.emitWebhookEvents(context, {
                decorate: async event => {
                    if (!context.properties.enrich || !event.contactId) {
                        return event;
                    }
                    try {
                        return { ...event, contactFields: await lib.enrichContact(context, event.contactId) || {} };
                    } catch (err) {
                        // The contact was still emitted by Emarsys; losing the extra fields must not
                        // cost the flow the event itself.
                        await context.log({ step: 'Could not load contact fields', contactId: event.contactId, message: err.message });
                        return event;
                    }
                }
            });
        }
    },

    async test(context) {
        throw lib.webhookTestError(context, 'New customer events');
    }
};
