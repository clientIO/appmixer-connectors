'use strict';

/**
 * Component trigger, which fires when the form is submitted from your Webflow site.
 * @extends {Component}
 */
module.exports = {
    async registerWebhook(context, siteId, webhookCallbackUrl) {
        // Define the API endpoint and payload for registering a webhook
        const url = `https://api.webflow.com/v2/sites/${siteId}/webhooks`;
        const payload = {
            triggerType: 'form_submission',
            url: webhookCallbackUrl
        };

        // Make the HTTP request to register the webhook
        const response = await context.httpRequest({
            url,
            method: 'POST',
            headers: {
                Authorization: `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/json',
                'accept-version': '2.0.0'
            },
            data: payload
        });

        return response.data; // Return the registered webhook data
    },

    async unregisterWebhook(context) {
        const {
            state: { webhookId }
        } = context;

        if (!webhookId) {
            return;
        }

        // Define the API endpoint for deleting a webhook
        const url = `https://api.webflow.com/v2/webhooks/${webhookId}`;
        await context.httpRequest({
            url,
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/json',
                'accept-version': '2.0.0'
            }
        });

        // Clear the state after successful deletion
        await context.saveState({ webhookId: null });
    },

    async start(context) {
        const {
            properties: { siteId }
        } = context;

        // Register the webhook and save its ID in the state
        const webhookData = await this.registerWebhook(
            context,
            siteId,
            context.getWebhookUrl()
        );
        await context.saveState({ webhookId: webhookData.id });
    },

    async stop(context) {
        // Unregister the webhook using the stored ID
        await this.unregisterWebhook(context);
    },

    async receive(context) {
        const { data } = context.messages.webhook.content;

        if (context.properties.formId && data.payload.formId !== context.properties.formId) {
            // Ignore the webhook if it doesn't match the specified form
            return context.response();
        }

        // Send the form submission data to the output port
        await context.sendJson(data, 'out');
        return context.response();
    }
};
