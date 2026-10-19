'use strict';

module.exports = {

    async start(context) {

        // PostHog has no API to register realtime destinations, so the user creates
        // the HTTP Webhook destination manually. Log the URL so it is easy to copy.
        await context.log({
            step: 'webhook-url',
            message: 'Create a PostHog realtime destination (HTTP Webhook) pointing to this URL.',
            webhookUrl: context.getWebhookUrl()
        });
    },

    async receive(context) {

        if (context.messages.webhook) {
            const payload = context.messages.webhook.content.data;
            await context.sendJson(payload, 'out');
            return context.response();
        }
    },

    async test(context) {

        // The shape of the delivered payload depends on how the user configures the
        // PostHog destination, so there is no API call that reproduces it faithfully.
        throw new context.CancelError(
            'This trigger cannot be tested without a real event. Start the flow and send a matching '
            + 'event to PostHog so the configured realtime destination delivers it to the webhook URL.'
        );
    }
};
