'use strict';

const lib = require('../../lib');
const gqlStore = require('../../gql-store');

const TOPIC = 'checkouts/update';

/**
 * Triggers when a checkout in the online store is updated.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return lib.registerWebhooks(context, [TOPIC], { extraFields: gqlStore.CHECKOUT_WEBHOOK_FIELDS });
    },

    async stop(context) {

        return lib.unregisterWebhooks(context);
    },

    async receive(context) {

        if (context.messages.webhook) {
            return lib.receiveWebhook(context, {
                port: 'out',
                type: 'AbandonedCheckout',
                fetch: gqlStore.checkoutFetcher(gqlStore(lib.runner(context)))
            });
        }
    },

    async test(context) {

        const [checkout] = await gqlStore(lib.runner(context)).listCheckouts({ max: 1 });
        if (!checkout) {
            throw new context.CancelError('The store has no abandoned checkouts to use as test data. Start a checkout in the online store and leave it before paying.');
        }
        return context.sendJson({ ...checkout, webhookTopic: TOPIC }, 'out');
    }
};
