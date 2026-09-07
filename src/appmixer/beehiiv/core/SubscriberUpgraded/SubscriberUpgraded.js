'use strict';

const api = require('../../api');
const lib = require('../../lib');

module.exports = {
    async start(context) {
        const { publicationId } = context.properties;
        const result = await api.Create8.execute(context, {
            publicationId,
            url: context.getWebhookUrl(),
            event_types: ['subscription.upgraded']
        });
        await context.saveState({ webhookId: result.data.id });
    },

    async stop(context) {
        const { webhookId } = context.state;
        if (!webhookId) return;
        const { publicationId } = context.properties;
        try {
            await api.Delete5.execute(context, { publicationId, endpointId: webhookId });
        } catch (err) {
            // Webhook may already be deleted
        }
        await context.saveState({ webhookId: null });
    },

    async receive(context) {
        const data = context.messages.webhook.content.data;
        await context.sendJson({ data }, 'out');
        return context.response();
    },

    async test(context) {
        const record = await lib.fetchLatestSubscription(context, { tier: 'premium' });
        if (!record) {
            throw new Error('No recent premium subscriptions to use as test data.');
        }
        return context.sendJson(lib.toWebhookShape(record, 'subscription.upgraded'), 'out');
    }
};
