'use strict';
const commons = require('../../lib');

function buildProduct(productInfo) {

    const { title, vendor, tags, published } = productInfo;

    let images = [];
    if (productInfo.images && Array.isArray(productInfo.images.ADD)) {
        images = productInfo.images.ADD;
    }

    return {
        title,
        vendor,
        tags,
        published,
        images: images,
        'body_html': productInfo.body_html,
        'product_type': productInfo.product_type
    };
}

/**
 * Create product.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context);

        if (!context.messages.in.content.title) {

            throw new context.CancelError('Title is required!');

        }


        const productData = buildProduct(context.messages.in.content);

        await context.log({ step: 'Creating product: ', ...productData });
        const product = await shopify.product.create(productData);
        return context.sendJson(product, 'product');
    }
};
