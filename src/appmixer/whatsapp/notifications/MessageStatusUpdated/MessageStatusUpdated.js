'use strict';

const lib = require('../../lib');

// See NewMessage.js for the model — same lifecycle, just listens on the
// `statuses:<wabaId>` event channel instead.

module.exports = {

    // Flow Test Mode: the WhatsApp Cloud API has no endpoint to list past status updates — this
    // trigger only ever gets data from a real message-status webhook. Fabricating a fake sample
    // would emit data that matches nothing real, so fail with a clear explanation instead.
    async test(context) {

        throw new context.CancelError(
            'Flow Test Mode is not available for this trigger: WhatsApp does not provide an API to '
            + 'fetch a message status update, so no real sample data can be produced. Send a message '
            + 'that reaches a delivered/read status to trigger the flow instead.'
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

        try {
            await lib.subscribeWabaApp(context, wabaId);
        } catch (err) {
            // Continue — Meta may already be subscribed.
        }

        await context.addListener(`statuses:${wabaId}`, {
            wabaId,
            accessToken: context.auth.accessToken
        });

        await context.saveState({ wabaId });
    },

    async stop(context) {

        const state = await context.loadState();
        const wabaId = (state && state.wabaId) || lib.resolveWabaId(context);
        if (!wabaId) return;

        await context.removeListener(`statuses:${wabaId}`);
    },

    async receive(context) {

        if (!context.messages.webhook) return;

        const data = context.messages.webhook.content && context.messages.webhook.content.data;
        if (!data) return;

        await context.sendJson(data, 'status');
    }
};
