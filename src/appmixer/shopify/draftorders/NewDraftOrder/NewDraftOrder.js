'use strict';

const lib = require('../../lib');
const gqlStore = require('../../gql-store');

const TOPIC = 'draft_orders/create';

/**
 * Triggers when a draft order is created.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return lib.registerWebhooks(context, [TOPIC]);
    },

    async stop(context) {

        return lib.unregisterWebhooks(context);
    },

    async receive(context) {

        if (context.messages.webhook) {
            const api = gqlStore(lib.runner(context));
            return lib.receiveWebhook(context, { port: 'out', type: 'DraftOrder', fetch: id => api.getDraftOrder(id) });
        }
    },

    async test(context) {

        const draftOrder = await gqlStore(lib.runner(context)).latestDraftOrder('ID');
        if (!draftOrder) {
            throw new context.CancelError('The store has no draft orders yet. Create one to get test data.');
        }
        return context.sendJson({ ...draftOrder, webhookTopic: TOPIC }, 'out');
    }
};
