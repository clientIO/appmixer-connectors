'use strict';
const commons = require('../../shopify-commons');

/**
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'orders/updated');
    },

    async receive(context) {

        if (context.messages.webhook) {
            const { data } = context.messages.webhook.content;

            const createdAt = new Date(data.created_at).getTime();
            const updatedAt = new Date(data.updated_at).getTime();

            const { updateThreshold = 2000 } = context.config;

            if (updatedAt > createdAt + updateThreshold ) {
                return commons.onReceive(context, 'order');
            }
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    }
};

