/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');

module.exports = {

    async tick(context) {

        const data = await lib.psRequest(context, {
            path: '/carts',
            params: {
                display: 'full',
                sort: '[date_upd_DESC]',
                date: 1,
                limit: 100
            }
        });

        const carts = data.carts || [];

        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, carts, 'id');

        // On the first run only seed the state so existing carts are not replayed.
        if (known) {
            for (const cart of diff) {
                // A cart is considered abandoned when there is no order associated with it.
                const orderData = await lib.psRequest(context, {
                    path: '/orders',
                    params: { 'filter[id_cart]': cart.id }
                });
                const hasOrder = (orderData.orders || []).length > 0;
                if (!hasOrder) {
                    await context.sendJson(cart, 'out');
                }
            }
        }

        await context.saveState({ known: actual });
    },

    // Flow Test Mode: emit one realistic abandoned cart without starting the flow or touching state.
    async test(context) {

        const data = await lib.psRequest(context, {
            path: '/carts',
            params: {
                display: 'full',
                sort: '[date_upd_DESC]',
                date: 1,
                limit: 20
            }
        });

        const carts = data.carts || [];

        for (const cart of carts) {
            const orderData = await lib.psRequest(context, {
                path: '/orders',
                params: { 'filter[id_cart]': cart.id }
            });
            const hasOrder = (orderData.orders || []).length > 0;
            if (!hasOrder) {
                return context.sendJson(cart, 'out');
            }
        }

        throw new Error('No abandoned cart available to use as test data.');
    }
};
