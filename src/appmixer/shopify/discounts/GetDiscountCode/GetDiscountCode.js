'use strict';
const lib = require('../../lib');
const gqlDiscounts = require('../../gql-discounts');

/**
 * Get the discount a discount code belongs to.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { code } = context.messages.in.content;

        if (!code) {
            throw new context.CancelError('Discount Code is required!');
        }

        const trimmedCode = String(code).trim();
        const discount = await gqlDiscounts(lib.runner(context)).getByCode(trimmedCode);

        if (!discount) {
            throw new context.CancelError(`Discount code ${trimmedCode} was not found.`);
        }

        return context.sendJson(discount, 'out');
    }
};
