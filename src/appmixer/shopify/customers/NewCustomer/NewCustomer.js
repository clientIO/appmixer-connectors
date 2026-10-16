'use strict';

const lib = require('../../lib');
const gqlCustomers = require('../../gql-customers');

const TOPIC = 'customers/create';

/**
 * Triggers when a customer is created.
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
            return lib.receiveWebhook(context, { port: 'out', type: 'Customer', fetch: id => api.getOrNull(id) });
        }
    },

    async test(context) {

        const api = gqlCustomers(lib.runner(context));
        const [customer] = await api.find({ sortKey: 'CREATED_AT', reverse: true, max: 1 });
        if (!customer) {
            throw new context.CancelError('The store has no customers yet. Create one to get test data.');
        }
        return context.sendJson({ ...customer, webhookTopic: TOPIC }, 'out');
    }
};
