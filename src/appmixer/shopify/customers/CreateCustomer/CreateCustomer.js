'use strict';

const lib = require('../../lib');
const gqlCustomers = require('../../gql-customers');

/**
 * Create a customer.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const {
            firstName, lastName, email, phone, note, tags, acceptsEmailMarketing,
            addressFirstName, addressLastName, company, address1, address2, city, provinceCode, countryCode, zip,
            addressPhone,
            taxExempt, taxExemptions, metafields
        } = context.messages.in.content;

        if (!firstName && !lastName && !email && !phone) {
            throw new context.CancelError('Enter at least a first name, last name, email or phone.');
        }
        if (acceptsEmailMarketing === true && !email) {
            throw new context.CancelError('Subscribing to email marketing needs an email address.');
        }

        try {
            const customer = await gqlCustomers(lib.runner(context)).create({
                firstName, lastName, email, phone, note, tags, taxExempt,
                taxExemptions: taxExemptions ? lib.normalizeMultiselectInput(taxExemptions, context, 'Tax Exemptions') : undefined,
                metafields: (metafields && metafields.ADD) || []
            }, {
                address: {
                    firstName: addressFirstName, lastName: addressLastName, company, address1, address2,
                    city, provinceCode, countryCode, zip, phone: addressPhone
                },
                acceptsEmailMarketing
            });
            return context.sendJson(customer, 'out');
        } catch (err) {
            // Rejected input (userErrors, invalid codes) does not get better by retrying.
            if (err.statusCode === 422) {
                throw new context.CancelError(err.message);
            }
            throw err;
        }
    }
};
