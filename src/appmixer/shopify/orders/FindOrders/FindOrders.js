'use strict';
const lib = require('../../lib');
const gqlOrders = require('../../gql-orders');

// One order as the out port carries it; the static order ports of the other
// order components carry the same schema (item-schema-orders.json).
const ITEM_SCHEMA = require('../../item-schema-orders.json').order;

const MAX_ORDERS = 250;

function toBoolean(value, defaultValue) {

    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return defaultValue;
}

/**
 * Find orders by a search query and filters.
 * @extends {Component}
 */
module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { outputType = 'array', sortKey, reverse, ...filters } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Orders' });
        }

        const api = gqlOrders(lib.runner(context));

        // The order picker of the inspector: newest orders, light.
        if (context.properties.isSource) {
            try {
                const orders = await api.pick({ query: gqlOrders.searchQuery(filters), max: 100 });
                return context.sendJson({ result: orders, count: orders.length }, 'out');
            } catch (err) {
                return context.sendJson({ result: [], count: 0 }, 'out');
            }
        }

        let query;
        try {
            query = gqlOrders.searchQuery(filters);
        } catch (err) {
            throw new context.CancelError(err.message);
        }

        const orders = await api.find({ query, sortKey, reverse: toBoolean(reverse, true), max: MAX_ORDERS });
        if (!orders.length) {
            return context.sendJson({}, 'notFound');
        }
        return lib.sendArrayOutput({ context, outputType, records: orders });
    },

    ordersToSelectArray(out) {

        const orders = Array.isArray(out) ? out : ((out && out.result) || []);
        return orders.map(order => {
            const total = order.totalPriceSet && order.totalPriceSet.shopMoney;
            const details = [order.email, total ? `${total.amount} ${total.currencyCode}` : null].filter(Boolean).join(', ');
            return { label: details ? `${order.name} (${details})` : order.name, value: order.id };
        });
    }
};
