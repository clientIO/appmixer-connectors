'use strict';

const crypto = require('crypto');
const lib = require('../../lib');
const gqlCustomers = require('../../gql-customers');

// The output contract of one customer (shared with Get/Create Customer and the
// customer triggers through item-schema-customers.json).
const ITEM_SCHEMA = require('../../item-schema-customers.json').customer;

// The customer picker of other components calls this component as a source;
// the result is cached so the burst of inspector calls costs one query.
const PICKER_CACHE_TTL_MS = 2 * 60 * 1000;

async function findCustomers(context, input) {

    const api = gqlCustomers(lib.runner(context));
    return api.find({
        query: gqlCustomers.buildSearchQuery(input),
        ...gqlCustomers.parseSort(input.sort)
    });
}

async function findCustomersCached(context, input) {

    const key = 'shopify-customers-picker-' + crypto.createHash('sha256')
        .update(JSON.stringify({ store: context.auth.store, token: context.auth.accessToken, input }))
        .digest('hex');
    const lock = await context.lock(key);
    try {
        const cached = await context.staticCache.get(key);
        if (cached) {
            return cached;
        }
        const customers = await findCustomers(context, input);
        await context.staticCache.set(key, customers, PICKER_CACHE_TTL_MS);
        return customers;
    } finally {
        lock.unlock();
    }
}

/**
 * Find customers by a search query and filters (up to 250).
 * @extends {Component}
 */
module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const input = context.messages.in.content;
        const { outputType = 'array' } = input;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Customers' });
        }

        if (context.properties.isSource) {
            try {
                const customers = await findCustomersCached(context, input);
                return context.sendJson({ result: customers, count: customers.length }, 'out');
            } catch (err) {
                return context.sendJson({ result: [], count: 0 }, 'out');
            }
        }

        const customers = await findCustomers(context, input);
        if (customers.length === 0) {
            return context.sendJson({}, 'notFound');
        }
        return lib.sendArrayOutput({ context, outputType, records: customers });
    },

    /**
     * Customer picker: label = display name (or email), value = global ID.
     * @param {object} out the `out` message of an `array` call
     * @returns {Array<{label: string, value: string}>}
     */
    customersToSelectArray(out) {

        const customers = (out && out.result) || [];
        return customers.map(customer => {
            const email = customer.defaultEmailAddress && customer.defaultEmailAddress.emailAddress;
            return { label: customer.displayName || email || customer.id, value: customer.id };
        });
    }
};
