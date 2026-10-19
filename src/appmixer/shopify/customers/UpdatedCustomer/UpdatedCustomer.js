'use strict';

const lib = require('../../lib');
const gqlCustomers = require('../../gql-customers');

const TOPIC = 'customers/update';

/**
 * Triggers when a customer is updated. The update that is part of creating a
 * customer (Shopify sends customers/update right after customers/create) is
 * skipped: the customer must have been updated more than `updateThreshold`
 * (default 2 s) after it was created.
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
            const api = gqlCustomers(lib.runner(context));
            const threshold = Number(context.config.updateThreshold) || 2000;
            return lib.receiveWebhook(context, {
                port: 'out',
                type: 'Customer',
                fetch: async id => {
                    const customer = await api.getOrNull(id);
                    return customer && gqlCustomers.updatedAfterCreate(customer, threshold) ? customer : null;
                }
            });
        }
    },

    async test(context) {

        const api = gqlCustomers(lib.runner(context));
        const threshold = Number(context.config.updateThreshold) || 2000;
        const customers = await api.find({ sortKey: 'UPDATED_AT', reverse: true, max: 10 });
        const customer = customers.find(item => gqlCustomers.updatedAfterCreate(item, threshold)) || customers[0];
        if (!customer) {
            throw new context.CancelError('The store has no customers yet. Create and update one to get test data.');
        }
        return context.sendJson({ ...customer, webhookTopic: TOPIC }, 'out');
    }
};
