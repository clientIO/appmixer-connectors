'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const { trimUndefined } = require('../../helpers');

module.exports = {

    async receive(context) {

        const {
            externalid, externalcheckoutid, source, email, currency, connectionid, customerid,
            totalPrice, externalCreatedDate, orderUrl, abandonedDate,
            productName, productPrice, productQuantity
        } = context.messages.in.content;

        // An order needs externalid; an abandoned cart needs externalcheckoutid
        // (ActiveCampaign sets state=2 only when externalcheckoutid is present).
        if (!externalid && !externalcheckoutid) {
            throw new context.CancelError('Either External ID (completed order) or External Checkout ID (abandoned cart) is required');
        }

        const required = {
            email, currency, connectionid, customerid, totalPrice,
            externalCreatedDate, orderUrl, productName, productPrice
        };
        for (const [key, val] of Object.entries(required)) {
            if (val === undefined || val === null || val === '') {
                throw new context.CancelError(`${key} is required`);
            }
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const productExternalId = externalid || externalcheckoutid;
        const payload = {
            ecomOrder: trimUndefined({
                externalid: externalid || undefined,
                externalcheckoutid: externalcheckoutid || undefined,
                source: source !== undefined && source !== '' ? Number(source) : 1,
                email,
                currency: currency.toUpperCase(),
                connectionid,
                customerid,
                totalPrice: Number(totalPrice),
                externalCreatedDate,
                externalUpdatedDate: externalCreatedDate,
                orderUrl,
                abandonedDate: abandonedDate || undefined,
                orderProducts: [
                    trimUndefined({
                        externalid: `${productExternalId}-p1`,
                        name: productName,
                        price: Number(productPrice),
                        quantity: productQuantity ? Number(productQuantity) : 1
                    })
                ]
            })
        };

        const { data } = await ac.call('post', 'ecomOrders', payload);

        return context.sendJson(data.ecomOrder, 'out');
    }
};
