'use strict';
const commons = require('../../shopify-commons');

/**
 * Component which triggers whenever new product comes.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'products/update');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'product');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    }
};
