'use strict';

const lib = require('../../lib');
const gqlCustomers = require('../../gql-customers');

/**
 * Get a customer by ID.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { id } = context.messages.in.content;
        if (!id) {
            throw new context.CancelError('Customer ID is required!');
        }

        const customer = await gqlCustomers(lib.runner(context)).get(id);
        return context.sendJson(customer, 'out');
    }
};
