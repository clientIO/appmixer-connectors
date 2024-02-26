'use strict';
const commons = require('../../shopify-commons');

/**
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'orders/cancelled');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'cancelled');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    }
};

