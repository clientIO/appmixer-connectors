'use strict';
const commons = require('../../shopify-commons');

/**
 * Component which triggers whenever new order comes.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'orders/create');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'order');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    }
};

