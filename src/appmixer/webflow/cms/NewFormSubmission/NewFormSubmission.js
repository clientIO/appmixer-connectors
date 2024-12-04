'use strict';

const TRIGGER_TYPE = 'form_submission';

/**
 * @extends {Component}
 */
module.exports = {
    async registerWebhook(apiKey, webhookId, siteId, webhookCallbackUrl, context) {
        const headers = {
            Authorization: `Bearer ${apiKey}`,
            'accept-version': '2.0.0',
            'Content-Type': 'application/json'
        };

        if (webhookId) {
            await this.unregisterWebhook(apiKey, webhookId, siteId, context);
        }

        const { data } = await context.httpRequest({
            url: `https://api.webflow.com/v2/sites/${siteId}/webhooks`,
            method: 'POST',
            headers,
            data: {
                triggerType: TRIGGER_TYPE,
                url: webhookCallbackUrl
            }
        });

        return data;
    },

    async unregisterWebhook(apiKey, webhookId, siteId, context) {
        if (!webhookId) return;

        const headers = {
            Authorization: `Bearer ${apiKey}`,
            'accept-version': '2.0.0'
        };

        await context.httpRequest({
            url: `https://api.webflow.com/v2/sites/${siteId}/webhooks/${webhookId}`,
            method: 'DELETE',
            headers
        });
    },

    async start(context) {
        const { state: { webhookId }, properties: { siteId }, auth: { apiKey } } = context;

        const webhook = await this.registerWebhook(
            apiKey,
            webhookId,
            siteId,
            context.getWebhookUrl(),
            context
        );

        await context.saveState({ webhookId: webhook._id });
    },

    async stop(context) {
        const { state: { webhookId }, properties: { siteId }, auth: { apiKey } } = context;

        await this.unregisterWebhook(apiKey, webhookId, siteId, context);
    },

    async receive(context) {
        const { data } = context.messages.webhook.content;

        if (context.properties.form && data.name !== context.properties.form) {
            return context.response(); // Ignore if form doesn't match
        }

        await context.sendJson(data, 'out');
        return context.response();
    }
};
