'use strict';

// Code discounts on the GraphQL Admin API. A discount is a DiscountCodeNode
// whose `codeDiscount` (DiscountCodeBasic, DiscountCodeBxgy, ...) holds the
// terms and the redeem codes. Components get the node with the `codeDiscount`
// fields lifted to the top level (`discountType` = its GraphQL type) and the
// `codes` connection as a plain array; everything else is what GraphQL returns.

const client = require('./graphql-client');

const MONEY = 'amount currencyCode';

const VALUE = `
    ... on DiscountPercentage { percentage }
    ... on DiscountAmount { amount { ${MONEY} } appliesOnEachItem }`;

const MINIMUM_REQUIREMENT = `
    minimumRequirement {
        ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { ${MONEY} } }
        ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
    }`;

const CUSTOMER_GETS = `customerGets { value { ${VALUE} } }`;

const COMMON_FIELDS = `
    title status startsAt endsAt usageLimit appliesOncePerCustomer asyncUsageCount createdAt updatedAt
    combinesWith { orderDiscounts productDiscounts shippingDiscounts }
    codes(first: 50) { nodes { id code asyncUsageCount createdAt } }`;

// Fields each code discount type has beyond the common ones.
const TYPE_FIELDS = {
    DiscountCodeBasic: `summary ${CUSTOMER_GETS} ${MINIMUM_REQUIREMENT}`,
    DiscountCodeBxgy: `summary ${CUSTOMER_GETS}`,
    DiscountCodeFreeShipping: `summary ${MINIMUM_REQUIREMENT}`,
    DiscountCodeApp: ''
};

const DISCOUNT_CODE_FIELDS = `
    id
    codeDiscount {
        discountType: __typename
        ${Object.keys(TYPE_FIELDS).map(type => `... on ${type} { ${COMMON_FIELDS} ${TYPE_FIELDS[type]} }`).join('\n        ')}
    }`;

const CREATE_BASIC_CODE = `mutation DiscountCodeBasicCreate($input: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $input) {
        codeDiscountNode { ${DISCOUNT_CODE_FIELDS} }
        userErrors { field message code }
    }
}`;

const GET_BY_CODE = `query DiscountCodeByCode($code: String!) {
    codeDiscountNodeByCode(code: $code) { ${DISCOUNT_CODE_FIELDS} }
}`;

const DELETE_CODE = `mutation DiscountCodeDelete($id: ID!) {
    discountCodeDelete(id: $id) {
        deletedCodeDiscountId
        userErrors { field message code }
    }
}`;

/**
 * DiscountCodeNode → { id, ...codeDiscount, codes: [...] }.
 * @param {object} node
 * @returns {object|null}
 */
function flatten(node) {

    if (!node) return null;
    const discount = node.codeDiscount || {};
    return {
        id: node.id,
        ...discount,
        codes: discount.codes ? discount.codes.nodes : []
    };
}

/**
 * DiscountCodeBasicInput: an amount or percentage off all items, for everyone.
 * @param {object} params
 * @param {string} params.code
 * @param {string} [params.title] defaults to the code
 * @param {'percentage'|'fixedAmount'} params.valueType
 * @param {number} params.value percentage (0-100) or amount in the store currency
 * @param {string} [params.startsAt] ISO date, defaults to now
 * @param {string} [params.endsAt]
 * @param {number} [params.usageLimit]
 * @param {boolean} [params.appliesOncePerCustomer]
 * @param {number} [params.minimumSubtotal]
 * @returns {object}
 */
function basicCodeInput(params) {

    const {
        code, title, valueType, value, startsAt, endsAt, usageLimit, appliesOncePerCustomer, minimumSubtotal
    } = params;
    const amount = Math.abs(Number(value));
    const input = {
        title: title || code,
        code,
        startsAt: startsAt || new Date().toISOString(),
        appliesOncePerCustomer: !!appliesOncePerCustomer,
        context: { all: 'ALL' },
        customerGets: {
            items: { all: true },
            value: valueType === 'percentage'
                // 15 (%) → 0.15; rounded so 7.1 does not become 0.07099999999999999.
                ? { percentage: Math.round(amount * 1e4) / 1e6 }
                : { discountAmount: { amount: String(amount), appliesOnEachItem: false } }
        }
    };
    if (endsAt) {
        input.endsAt = endsAt;
    }
    if (usageLimit) {
        input.usageLimit = Number(usageLimit);
    }
    if (minimumSubtotal !== undefined && minimumSubtotal !== null && minimumSubtotal !== '') {
        input.minimumRequirement = { subtotal: { greaterThanOrEqualToSubtotal: String(minimumSubtotal) } };
    }
    return input;
}

module.exports = (run) => ({

    /**
     * Create a basic code discount with one code. Terms and code are created
     * in one mutation, so a refused code (e.g. a duplicate, 422) leaves
     * nothing behind.
     * @param {object} params see basicCodeInput
     * @returns {Promise<object>} the discount
     */
    async createBasicCode(params) {

        const data = await run(CREATE_BASIC_CODE, { input: basicCodeInput(params) });
        const payload = client.checkUserErrors(data.discountCodeBasicCreate, 'discountCodeBasicCreate');
        return flatten(payload.codeDiscountNode);
    },

    /**
     * The discount a code belongs to (codes are case-insensitive).
     * @param {string} code
     * @returns {Promise<object|null>} null when no discount has the code
     */
    async getByCode(code) {

        const data = await run(GET_BY_CODE, { code });
        return flatten(data.codeDiscountNodeByCode);
    },

    /**
     * Delete a code discount together with all its codes.
     * @param {number|string} id DiscountCodeNode gid or numeric id
     * @returns {Promise<void>}
     */
    async delete(id) {

        const data = await run(DELETE_CODE, { id: client.toGid('DiscountCodeNode', id) });
        client.checkUserErrors(data.discountCodeDelete, 'discountCodeDelete');
    }
});

module.exports.DISCOUNT_CODE_FIELDS = DISCOUNT_CODE_FIELDS;
module.exports.basicCodeInput = basicCodeInput;
module.exports.flatten = flatten;
