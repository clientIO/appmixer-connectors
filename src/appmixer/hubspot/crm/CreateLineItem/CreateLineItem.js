'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const {
            productId,
            name,
            quantity,
            recurringBillingPeriod,
            recurringBillingFrequency,
            price
        } = context.messages.lineItem.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            properties: {
                name: name,
                hs_product_id: productId,
                quantity,
                price,
                recurring_billing_period: recurringBillingPeriod,
                recurringbillingfrequency: recurringBillingFrequency
            }
        };


        const { data } = await hs.call('post', 'crm/v3/objects/line_items', payload);
        const { properties } = data;

        const lineItem = {
            id: data.id,
            productId: properties.hs_product_id,
            quantity: properties.quantity,
            name: properties.name,
            price: properties.price,
            amount: properties.amount,
            recurringBillingPeriod: properties.hs_recurring_billing_period,
            recurringBillingFrequency: properties.recurringbillingfrequency
        };

        return context.sendJson(lineItem, 'newLineItem');
    }
};
