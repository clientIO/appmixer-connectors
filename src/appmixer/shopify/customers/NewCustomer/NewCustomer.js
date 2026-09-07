'use strict';
const commons = require('../../lib');

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
    },

    async test(context) {

        const customer = await commons.fetchLatestWebhookExample(context, {
            resource: 'customer',
            topic: 'customers/create',
            params: { order: 'created_at DESC' }
        });
        if (!customer) {
            throw new Error('No recent customers to use as test data.');
        }
        return context.sendJson(customer, 'customer');
    }
};
