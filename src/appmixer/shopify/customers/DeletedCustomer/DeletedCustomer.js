'use strict';
const commons = require('../../shopify-commons');

/**
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'customers/delete');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'deleted');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    }
};
