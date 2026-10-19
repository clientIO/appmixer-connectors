'use strict';

const lib = require('../../lib');

const DEFAULT_DUE_DATE_KEY = 'due_date';

const WEBHOOK_URL_TOOLTIP = 'Emarsys cannot register webhooks through its API. Copy this URL into an Automation '
    + 'Center webhook node preset (Automation > Webhook Node Presets), then build an audience-based program with '
    + 'a daily "Recurring" entry point, a segment that selects the contacts whose due date is coming up, and that '
    + 'webhook node. Send at least <code>contact_id</code>, <code>email</code> and the due date as contact data. '
    + 'Pause the Emarsys program before you stop this flow, otherwise the program drops into fail-safe mode after '
    + 'repeated delivery failures.';

module.exports = {

    // Nothing to subscribe to — the user wires the webhook node by hand — so start() only records
    // the URL that the Emarsys preset is expected to point at. Nothing reads it back; it exists so
    // the component's state shows which URL this instance handed out when a delivery does not
    // arrive.
    async start(context) {
        await context.saveState({ webhookUrl: context.getWebhookUrl() });
    },

    async receive(context) {

        // Dynamic inspector: surface the read-only Webhook URL for the user to copy into Emarsys.
        if (context.properties.generateInspector) {
            return context.sendJson(lib.webhookUrlInspector(context, WEBHOOK_URL_TOOLTIP), 'out');
        }

        if (context.messages.webhook) {
            const dueDateKey = context.properties.dueDateKey || DEFAULT_DUE_DATE_KEY;

            return lib.emitWebhookEvents(context, {
                decorate: async event => {
                    // Emarsys has no billing object: the due date is whatever custom contact field
                    // the customer maps into the preset, so lift it out by its configured key.
                    const decorated = { ...event, dueDate: lib.pickString(event.contact, [dueDateKey]) };

                    if (!context.properties.enrich || !event.contactId) {
                        return decorated;
                    }
                    try {
                        return { ...decorated, contactFields: await lib.enrichContact(context, event.contactId) || {} };
                    } catch (err) {
                        // The contact was still emitted by Emarsys; losing the extra fields must not
                        // cost the flow the event itself.
                        await context.log({ step: 'Could not load contact fields', contactId: event.contactId, message: err.message });
                        return decorated;
                    }
                }
            });
        }
    },

    async test(context) {
        throw lib.webhookTestError(context, 'Billing due date events');
    }
};
