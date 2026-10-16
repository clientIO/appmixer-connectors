'use strict';
const lib = require('../../lib');
const gqlOrders = require('../../gql-orders');
const client = require('../../graphql-client');

function present(value) {

    return value !== undefined && value !== null && String(value).trim() !== '';
}

/**
 * Component inputs → OrderInput. Empty fields are left out (not changed).
 * @param {object} inputs
 * @returns {object}
 */
function toOrderInput(inputs) {

    const input = { id: String(inputs.id).trim() };
    for (const key of ['email', 'phone', 'note', 'poNumber']) {
        if (present(inputs[key])) input[key] = String(inputs[key]).trim();
    }
    if (present(inputs.tags)) input.tags = client.tagList(inputs.tags);
    const shippingAddress = gqlOrders.mailingAddress({
        firstName: inputs.shippingFirstName,
        lastName: inputs.shippingLastName,
        company: inputs.shippingCompany,
        address1: inputs.shippingAddress1,
        address2: inputs.shippingAddress2,
        city: inputs.shippingCity,
        provinceCode: inputs.shippingProvinceCode,
        countryCode: inputs.shippingCountryCode,
        zip: inputs.shippingZip,
        phone: inputs.shippingPhone
    }, 'Shipping');
    if (shippingAddress) input.shippingAddress = shippingAddress;
    return input;
}

/**
 * Update an order.
 * @extends {Component}
 */
module.exports = {

    toOrderInput,

    async receive(context) {

        const inputs = context.messages.in.content;
        if (!inputs.id) {
            throw new context.CancelError('Order ID is required!');
        }

        let input;
        try {
            input = toOrderInput(inputs);
        } catch (err) {
            throw new context.CancelError(err.message);
        }

        await gqlOrders(lib.runner(context)).update(input);
        return context.sendJson({}, 'out');
    }
};
