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
    }
};

