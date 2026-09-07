'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');

/**
 * Triggers when an item has been archived in a board.
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
                    event: 'item_archived'
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

    // Flow Test Mode: emit one realistic item_archived webhook event without registering a
    // webhook. The archive event fires when an existing item is archived, so the newest current
    // item on the board is a faithful representative of what would be archived. Reuses the shared
    // helpers and reshapes the item into the exact `event` body the webhook delivers (type
    // archive_pulse) on 'out'.
    async test(context) {

        const item = await commons.fetchLatestItem(context);
        if (!item) {
            throw new Error('No items on the board to use as test data.');
        }
        return context.sendJson(commons.toWebhookEvent(context, item, 'archive_pulse'), 'out');
    }
};

