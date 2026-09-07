/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { productId } = context.messages.in.content;

        if (!productId) {
            throw new context.CancelError('Product ID is required!');
        }

        const data = await lib.psRequest(context, { path: `/products/${productId}` });
        const product = data.product;

        if (!product) {
            throw new context.CancelError(`Product ${productId} not found.`);
        }

        return context.sendJson(product, 'out');
    }
};
