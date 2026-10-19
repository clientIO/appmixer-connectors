'use strict';
const lib = require('../../lib');
const gqlOrders = require('../../gql-orders');
const client = require('../../graphql-client');

const DISCOUNT_TYPES = ['FIXED_AMOUNT', 'PERCENTAGE', 'FREE_SHIPPING'];

function present(value) {

    return value !== undefined && value !== null && String(value).trim() !== '';
}

function toBoolean(value) {

    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
}

// Expression input ({ ADD: [...] }) or a plain array → array of rows.
function rows(value) {

    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.ADD)) return value.ADD;
    return [];
}

function amount(value, name) {

    const number = Number(value);
    if (!present(value) || !Number.isFinite(number)) {
        throw new client.ShopifyError(`${name} must be a number, got "${value}".`, 422);
    }
    return String(number);
}

/**
 * Whether the inputs carry a money amount, so the order currency is needed.
 * @param {object} inputs
 * @returns {boolean}
 */
function needsCurrency(inputs) {

    return rows(inputs.lineItems).some(item => item.itemType === 'custom' || (!present(item.variantId) && present(item.price)))
        || rows(inputs.taxLines).some(tax => present(tax.price))
        || (present(inputs.discountCode) && (inputs.discountType || 'FIXED_AMOUNT') === 'FIXED_AMOUNT');
}

/**
 * Component inputs → OrderCreateOrderInput.
 * @param {object} inputs
 * @param {string} [currency] currency of the amounts given (the shop currency unless set)
 * @returns {object}
 */
function toOrderInput(inputs, currency) {

    const bag = value => ({ shopMoney: { amount: value, currencyCode: currency } });
    const order = {};

    const lineItems = rows(inputs.lineItems).map((item, index) => {
        const position = `Line item ${index + 1}`;
        const quantity = parseInt(item.quantity, 10);
        const line = { quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1 };
        const custom = item.itemType === 'custom' || (!item.itemType && !present(item.variantId));
        if (!custom) {
            if (!present(item.variantId)) {
                throw new client.ShopifyError(`${position}: choose a product variant, or switch the item type to Custom.`, 422);
            }
            line.variantId = client.toGid('ProductVariant', String(item.variantId).trim());
            return line;
        }
        if (!present(item.title)) {
            throw new client.ShopifyError(`${position}: a custom item needs a title.`, 422);
        }
        line.title = String(item.title).trim();
        line.priceSet = bag(amount(item.price, `${position} price`));
        if (present(item.sku)) line.sku = String(item.sku).trim();
        if (toBoolean(item.taxable) !== undefined) line.taxable = toBoolean(item.taxable);
        if (toBoolean(item.requiresShipping) !== undefined) line.requiresShipping = toBoolean(item.requiresShipping);
        return line;
    });
    if (!lineItems.length) {
        throw new client.ShopifyError('An order needs at least one line item.', 422);
    }
    order.lineItems = lineItems;

    for (const key of ['email', 'phone', 'note', 'poNumber']) {
        if (present(inputs[key])) order[key] = String(inputs[key]).trim();
    }
    if (present(inputs.currency)) order.currency = String(inputs.currency).trim().toUpperCase();
    if (present(inputs.financialStatus)) order.financialStatus = String(inputs.financialStatus).trim().toUpperCase();
    if (present(inputs.tags)) order.tags = client.tagList(inputs.tags);
    for (const key of ['test', 'taxesIncluded', 'buyerAcceptsMarketing']) {
        if (toBoolean(inputs[key]) !== undefined) order[key] = toBoolean(inputs[key]);
    }

    if (present(inputs.customerId)) {
        order.customer = { toAssociate: { id: client.toGid('Customer', String(inputs.customerId).trim()) } };
    } else {
        const toUpsert = {};
        for (const [input, field] of [['customerEmail', 'email'], ['customerFirstName', 'firstName'],
            ['customerLastName', 'lastName'], ['customerPhone', 'phone']]) {
            if (present(inputs[input])) toUpsert[field] = String(inputs[input]).trim();
        }
        if (Object.keys(toUpsert).length) order.customer = { toUpsert };
    }

    const address = prefix => gqlOrders.mailingAddress({
        firstName: inputs[`${prefix}FirstName`],
        lastName: inputs[`${prefix}LastName`],
        company: inputs[`${prefix}Company`],
        address1: inputs[`${prefix}Address1`],
        address2: inputs[`${prefix}Address2`],
        city: inputs[`${prefix}City`],
        provinceCode: inputs[`${prefix}ProvinceCode`],
        countryCode: inputs[`${prefix}CountryCode`],
        zip: inputs[`${prefix}Zip`],
        phone: inputs[`${prefix}Phone`]
    }, prefix === 'billing' ? 'Billing' : 'Shipping');
    const billingAddress = address('billing');
    if (billingAddress) order.billingAddress = billingAddress;
    const shippingAddress = address('shipping');
    if (shippingAddress) order.shippingAddress = shippingAddress;

    if (present(inputs.discountCode)) {
        const code = String(inputs.discountCode).trim();
        const type = present(inputs.discountType) ? String(inputs.discountType).trim().toUpperCase() : 'FIXED_AMOUNT';
        if (!DISCOUNT_TYPES.includes(type)) {
            throw new client.ShopifyError(`Unsupported discount type "${inputs.discountType}".`, 422);
        }
        if (type === 'FREE_SHIPPING') {
            order.discountCode = { freeShippingDiscountCode: { code } };
        } else if (type === 'PERCENTAGE') {
            order.discountCode = { itemPercentageDiscountCode: { code, percentage: Number(amount(inputs.discountValue, 'Discount value')) } };
        } else {
            order.discountCode = { itemFixedDiscountCode: { code, amountSet: bag(amount(inputs.discountValue, 'Discount value')) } };
        }
    }

    const taxLines = rows(inputs.taxLines).filter(tax => present(tax.title) || present(tax.rate)).map((tax, index) => {
        if (!present(tax.title) || !present(tax.rate)) {
            throw new client.ShopifyError(`Tax line ${index + 1} needs a title and a rate.`, 422);
        }
        const line = { title: String(tax.title).trim(), rate: amount(tax.rate, `Tax line ${index + 1} rate`) };
        if (present(tax.price)) line.priceSet = bag(amount(tax.price, `Tax line ${index + 1} amount`));
        return line;
    });
    if (taxLines.length) order.taxLines = taxLines;

    return order;
}

/**
 * Create an order.
 * @extends {Component}
 */
module.exports = {

    toOrderInput,
    needsCurrency,

    async receive(context) {

        const inputs = context.messages.in.content;
        if (!rows(inputs.lineItems).length) {
            throw new context.CancelError('At least one line item is required!');
        }

        const api = gqlOrders(lib.runner(context));
        let currency = present(inputs.currency) ? String(inputs.currency).trim().toUpperCase() : null;
        if (!currency && needsCurrency(inputs)) {
            currency = await api.shopCurrency();
        }

        let order;
        try {
            order = toOrderInput(inputs, currency);
        } catch (err) {
            throw new context.CancelError(err.message);
        }

        const created = await api.create(order, {
            // Stock is left as it is unless asked otherwise; no e-mails by default.
            inventoryBehaviour: inputs.inventoryBehaviour || 'BYPASS',
            sendReceipt: toBoolean(inputs.sendReceipt) || false,
            sendFulfillmentReceipt: false
        });
        return context.sendJson(created, 'out');
    }
};
