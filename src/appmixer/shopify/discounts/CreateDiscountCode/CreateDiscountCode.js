'use strict';
const lib = require('../../lib');
const gqlDiscounts = require('../../gql-discounts');

// Unambiguous alphabet — no I/O/0/1 — so a generated code survives being read
// off a screen or dictated over the phone.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GENERATED_CODE_LENGTH = 8;

// Shopify has no "generate a code for me" option: the code string is always
// supplied by the caller, so build one when the user left the field empty.
function generateCode() {

    let code = '';
    for (let i = 0; i < GENERATED_CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
}

/**
 * Create a basic code discount (a percentage or a fixed amount off the order)
 * with one discount code.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const {
            valueType,
            value,
            code,
            title,
            minimumSubtotal,
            startsAt,
            endsAt,
            usageLimit,
            appliesOncePerCustomer
        } = context.messages.in.content;

        if (!valueType) {
            throw new context.CancelError('Discount Type is required!');
        }
        if (value === undefined || value === null || value === '') {
            throw new context.CancelError('Discount Value is required!');
        }

        const amount = Math.abs(Number(value));
        if (!Number.isFinite(amount) || amount === 0) {
            throw new context.CancelError('Discount Value must be a non-zero number!');
        }
        if (valueType === 'percentage' && amount > 100) {
            throw new context.CancelError('A percentage discount cannot be greater than 100!');
        }

        const discountCode = code ? String(code).trim() : generateCode();

        const discount = await gqlDiscounts(lib.runner(context)).createBasicCode({
            code: discountCode,
            title,
            valueType,
            value: amount,
            startsAt,
            endsAt,
            usageLimit,
            appliesOncePerCustomer,
            minimumSubtotal
        });

        return context.sendJson(discount, 'out');
    }
};
