'use strict';

const lib = require('../../lib');
const gqlStore = require('../../gql-store');

// Each step of the return journey fires its own webhook topic (a customer
// request fires returns/request, an admin approval returns/approve, ...) —
// returns/update alone never fires during the standard journey, so the
// trigger subscribes to every selected topic and emits the topic name.
const TOPICS = [
    'returns/request',
    'returns/approve',
    'returns/decline',
    'returns/cancel',
    'returns/close',
    'returns/reopen',
    'returns/update'
];

// The selected topics; all of them when none is selected.
function selectedTopics(context) {

    const topics = context.properties.topics
        ? lib.normalizeMultiselectInput(context.properties.topics, context, 'Return Events')
        : [];
    const valid = topics.filter(topic => TOPICS.includes(topic));
    return valid.length ? valid : TOPICS;
}

/**
 * Triggers on the selected return events.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return lib.registerWebhooks(context, selectedTopics(context));
    },

    async stop(context) {

        return lib.unregisterWebhooks(context);
    },

    async receive(context) {

        if (context.messages.webhook) {
            const api = gqlStore(lib.runner(context));
            return lib.receiveWebhook(context, { port: 'out', type: 'Return', fetch: id => api.getReturn(id) });
        }
    },

    async test(context) {

        const ret = await gqlStore(lib.runner(context)).latestReturn();
        if (!ret) {
            throw new context.CancelError('The store has no returns on its recent orders. Create a return to get test data.');
        }
        return context.sendJson({ ...ret, webhookTopic: selectedTopics(context)[0] }, 'out');
    }
};
