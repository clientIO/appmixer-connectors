'use strict';
const lib = require('../../lib');
const gqlDiscounts = require('../../gql-discounts');

/**
 * Delete a code discount together with all its discount codes.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { id } = context.messages.in.content;

        if (!id) {
            throw new context.CancelError('Discount ID is required!');
        }

        await gqlDiscounts(lib.runner(context)).delete(id);

        return context.sendJson({}, 'out');
    }
};
