'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');

/**
 * Triggers when an item has been created in a board.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        const data = await commons.makeRequest({
            query: queries.RegisterAWebhook,
            options: {
                variables: {
                    boardId: +(context.properties.boardId),
                    webhookUrl: context.getWebhookUrl(),
                    event: 'create_item'
                }
            },
            apiKey: context.auth.apiKey
        });

        if (data['create_webhook']) {
            await context.saveState({ webhookId: data['create_webhook'].id });
        } else {
            throw new Error('Missing Webhook ID.');
        }
    },
    async stop(context) {

        return commons.makeRequest({
            query: queries.UnregisterAWebhook,
            options: {
                variables: { id: +(context.state.webhookId) }
            },
            apiKey: context.auth.apiKey
        });
    },

    async receive(context) {

        const { challenge, event } = context.messages.webhook?.content?.data || {};

        if (challenge) {
            return context.response(context.messages.webhook.content.data);
        }
        if (event) {
            await context.sendJson(event, 'out');
            return context.response({});
        }
    },

    // Flow Test Mode: emit one realistic create_item webhook event without registering a webhook.
    // Reuses the connector-level helpers shared by every monday item webhook trigger: fetch the
    // newest item on the configured board via the read-only GraphQL API and reshape it into the
    // exact `event` body the webhook would deliver (the shape receive() forwards on 'out').
    async test(context) {

        const item = await commons.fetchLatestItem(context);
        if (!item) {
            throw new Error('No items on the board to use as test data.');
        }
        return context.sendJson(commons.toWebhookEvent(context, item, 'create_pulse'), 'out');
    }
};

