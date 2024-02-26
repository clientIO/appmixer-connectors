'use strict';
const commons = require('../../shopify-commons');

function buildCustomer(customerInfo) {
    const { firstName, lastName, email, phone, note, tags } = customerInfo;
    const customer = {};

    let metafields = [];
    if (customerInfo.metafields && Array.isArray(customerInfo.metafields.AND)) {
        metafields = customerInfo.metafields.AND.filter(metafield => metafield.key !== '');
    }

    if (firstName) {
        customer['first_name'] = firstName;
    }

    if (lastName) {
        customer['last_name'] = lastName;
    }

    if (email) {
        customer['email'] = email;
    }

    if (phone) {
        customer['phone'] = phone;
    }

    if (note) {
        customer['note'] = note;
    }

    if (tags) {
        customer['tags'] = tags;
    }

    if (customerInfo.accepts_marketing_updated_at) {
        customer['accepts_marketing_updated_at'] = customerInfo.accepts_marketing_updated_at;
    }

    customer['accepts_marketing'] = customerInfo.accepts_marketing;
    customer['tax_exempt'] = customerInfo.tax_exempt;

    if (Array.isArray(customerInfo.tax_exemptions)) {
        customer['tax_exemptions'] = customerInfo.tax_exemptions;
    }

    if (metafields.length > 0) {
        customer['metafields'] = metafields;
    }

    return customer;
}

/**
 * Update customer.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);
        const customerInfo = context.messages.in.content;
        const { id } = customerInfo;

        const updatedCustomer = await shopify.customer.update(id, buildCustomer(customerInfo));
        return context.sendJson(updatedCustomer, 'customer');
    }
};
