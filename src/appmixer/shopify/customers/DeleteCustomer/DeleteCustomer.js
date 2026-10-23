'use strict';

const lib = require('../../lib');
const gqlCustomers = require('../../gql-customers');

/**
 * Delete a customer.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { id } = context.messages.in.content;
        if (!id) {
            throw new context.CancelError('Customer ID is required!');
        }

        try {
            await gqlCustomers(lib.runner(context)).delete(id);
        } catch (err) {
            // Customer not found, or it has orders and Shopify refuses to delete it.
            if (err.statusCode === 422) {
                throw new context.CancelError(err.message);
            }
            throw err;
        }
        return context.sendJson({}, 'out');
    }
};
