'use strict';

const lib = require('../../lib');
const gqlCustomers = require('../../gql-customers');

/**
 * Update a customer; only the filled-in fields change.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const {
            id, firstName, lastName, email, phone, note, tags, emailMarketingState,
            taxExempt, taxExemptions, metafields
        } = context.messages.in.content;

        if (!id) {
            throw new context.CancelError('Customer ID is required!');
        }

        try {
            await gqlCustomers(lib.runner(context)).update(id, {
                firstName, lastName, email, phone, note, tags, taxExempt,
                taxExemptions: taxExemptions ? lib.normalizeMultiselectInput(taxExemptions, context, 'Tax Exemptions') : undefined,
                metafields: (metafields && metafields.ADD) || []
            }, { emailMarketingState });
        } catch (err) {
            // Rejected input (userErrors) does not get better by retrying.
            if (err.statusCode === 422) {
                throw new context.CancelError(err.message);
            }
            throw err;
        }
        return context.sendJson({}, 'out');
    }
};
