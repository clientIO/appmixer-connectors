'use strict';

const lib = require('../../lib');
const gqlCustomers = require('../../gql-customers');

const TOPIC = 'customers/delete';

/**
 * Triggers when a customer is deleted. Emits the ID of the deleted customer.
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
            return lib.receiveWebhook(context, { port: 'out', type: 'Customer' });
        }
    },

    // A deleted customer cannot be read back; the newest customer's ID shows
    // the shape of the output.
    async test(context) {

        const api = gqlCustomers(lib.runner(context));
        const [customer] = await api.find({ sortKey: 'CREATED_AT', reverse: true, max: 1 });
        if (!customer) {
            throw new context.CancelError('The store has no customers yet. Create one to get test data.');
        }
        return context.sendJson({ id: customer.id, webhookTopic: TOPIC }, 'out');
    }
};
