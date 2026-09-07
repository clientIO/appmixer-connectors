'use strict';

const api = require('../../api');
const lib = require('../../lib');

module.exports = {
    async start(context) {
        const { publicationId } = context.properties;
        const result = await api.Create8.execute(context, {
            publicationId,
            url: context.getWebhookUrl(),
            event_types: ['subscription.deleted']
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
        // A deleted subscriber can no longer be fetched, but the delivered payload is a snapshot
        // of the subscription record (same shape as a live one), so the newest existing
        // subscription faithfully represents the emitted body.
        const record = await lib.fetchLatestSubscription(context);
        if (!record) {
            throw new Error('No recent subscriptions to use as test data.');
        }
        return context.sendJson(lib.toWebhookShape(record, 'subscription.deleted'), 'out');
    }
};
