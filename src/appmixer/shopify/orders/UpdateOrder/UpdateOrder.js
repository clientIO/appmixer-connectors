'use strict';
const commons = require('../../shopify-commons');

function buildOrder(orderInfo) {

    const { id, email, phone, note, tags } = orderInfo;
    const order = {
        'buyer_accepts_marketing': orderInfo.buyer_accepts_marketing
    };

    if (id) {
        order.id = id;
    }

    if (email) {
        order.email = email;
    }

    if (phone) {
        order.phone = phone;
    }

    if (note) {
        order.note = note;
    }

    if (tags) {
        order.tags = tags;
    }

    if (orderInfo.shipping_first_name && orderInfo.shipping_last_name && orderInfo.shipping_address1) {
        order['shipping_address'] = {
            'first_name': orderInfo.shipping_first_name,
            'last_name': orderInfo.shipping_last_name,
            'phone': orderInfo.shipping_phone,
            'address1': orderInfo.shipping_address1,
            'city': orderInfo.shipping_city,
            'country': orderInfo.shipping_country,
            'province': orderInfo.shipping_province,
            'zip': orderInfo.shipping_zip
        };
    }

    return order;
}

/**
 * Update an order.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);
        const orderInfo = context.messages.in.content;
        const { id } = orderInfo;

        const order = await shopify.order.update(id, buildOrder(orderInfo));
        return context.sendJson(order, 'order');
    }
};
