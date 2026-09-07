'use strict';
const commons = require('../../lib');

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

module.exports = {

    async start(context) {

        let topics = context.properties.topics
            ? commons.normalizeMultiselectInput(context.properties.topics, context, 'Return Events')
            : [];
        topics = topics.filter(topic => TOPICS.includes(topic));
        if (!topics.length) {
            topics = TOPICS;
        }
        return commons.registerWebhooks(context, topics);
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'return');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    },

    async test(context) {

        const shopify = commons.getShopifyAPI(context);
        // Returns are only exposed through GraphQL; fetch the newest return of the
        // most recent order so the emitted shape matches the webhook payload.
        const orders = await shopify.order.list({ status: 'any', limit: 10, order: 'created_at DESC' });

        if (!Array.isArray(orders)) {
            throw new Error('No orders to look up returns for.');
        }

        for (const order of orders) {
            const query = `query {
                order(id: "gid://shopify/Order/${order.id}") {
                    returns(first: 1) {
                        edges { node {
                            id name status totalQuantity
                            order { id name }
                        } }
                    }
                }
            }`;
            let result;
            try {
                result = await shopify.graphql(query);
            } catch (err) {
                continue;
            }
            const edges = result && result.order && result.order.returns && result.order.returns.edges;
            if (Array.isArray(edges) && edges[0]) {
                return context.sendJson({ ...edges[0].node, webhookTopic: 'returns/request' }, 'return');
            }
        }

        throw new Error('No returns to use as test data. Ensure the store has returns and the token has read_returns scope.');
    }
};
