'use strict';

const lib = require('../../lib');

// Plugin-based webhook routing — see routes.js for the model.
// The trigger:
//   1) subscribes the user's WABA to the Meta App (POST /{wabaId}/subscribed_apps)
//      so Meta starts pushing events to the global plugin /events endpoint
//   2) addListener('messages:<wabaId>', { ... }) to register this trigger
//      instance as a consumer of those events
// stop() removes the listener but does NOT unsubscribe the WABA — other
// flows on the same WABA may still need it.

module.exports = {

    // Flow Test Mode: the WhatsApp Cloud API has no endpoint to list received messages — this
    // trigger only ever gets data from a real inbound-message webhook. Fabricating a fake sample
    // would emit data that matches nothing real, so fail with a clear explanation instead.
    async test(context) {

        throw new context.CancelError(
            'Flow Test Mode is not available for this trigger: WhatsApp does not provide an API to '
            + 'fetch a received message, so no real sample data can be produced. Send an actual '
            + 'WhatsApp message to your number to trigger the flow instead.'
        );
    },

    async start(context) {

        // Form override (inspector input) wins over the auto-discovered default
        // from the OAuth profile.
        const wabaId = (context.properties && context.properties.businessAccountId)
            || lib.resolveWabaId(context);

        if (!wabaId) {
            throw new context.CancelError(
                'No WhatsApp Business Account ID. Either fill the inspector field, ' +
                'or reconnect the WhatsApp account so the WABA is discovered automatically.'
            );
        }

        // Ensure Meta is delivering events for this WABA to the plugin endpoint.
        try {
            await lib.subscribeWabaApp(context, wabaId);
        } catch (err) {
            // Continue — Meta may already be subscribed.
        }

        await context.addListener(`messages:${wabaId}`, {
            wabaId,
            accessToken: context.auth.accessToken
        });

        await context.saveState({ wabaId });
    },

    async stop(context) {

        const state = await context.loadState();
        const wabaId = (state && state.wabaId) || lib.resolveWabaId(context);
        if (!wabaId) return;

        await context.removeListener(`messages:${wabaId}`);
    },

    async receive(context) {

        if (!context.messages.webhook) return;

        // Payload was placed there by routes.js → triggerListeners()
        const data = context.messages.webhook.content && context.messages.webhook.content.data;
        if (!data) return;

        await context.sendJson(data, 'message');
    }
};
