'use strict';
const commons = require('../../shopify-commons');

/**
 * Component which triggers whenever new customer comes.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'customers/create');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'customer');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    }
};
