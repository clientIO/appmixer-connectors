'use strict';
const commons = require('../../shopify-commons');

function buildProduct(oldProduct, productInfo) {

    const { id, title, vendor, tags, published, attachment } = productInfo;
    const product = {};

    if (id) {
        product.id = id;
    }

    if (title) {
        product.title = title;
    }

    if (vendor) {
        product.vendor = vendor;
    }

    if (tags) {
        product.tags = tags;
    }

    if (published) {
        product.published = published;
    }

    if (productInfo.body_html) {
        product.body_html = productInfo.body_html;
    }

    if (productInfo.product_type) {
        product.product_type = productInfo.product_type;
    }

    if (attachment) {
        const { images } = oldProduct;

        if (images && Array.isArray(images)) {
            images.push({ attachment });
            product.images = images;
        } else {
            product.images = [{ attachment }];
        }
    }

    return product;
}

/**
 * Update product.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);
        const productInfo = context.messages.in.content;
        const { id } = productInfo;

        const product = await shopify.product.get(id, { fields: 'id,images' });
        const updatedProduct = await shopify.product.update(id, buildProduct(product, productInfo));
        return context.sendJson(updatedProduct, 'product');
    }
};
