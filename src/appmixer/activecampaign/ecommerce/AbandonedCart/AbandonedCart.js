'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

// ActiveCampaign ecomOrder state: 0=Pending, 1=Completed, 2=Abandoned, 3=Recovered, 4=Waiting.
const STATE_ABANDONED = 2;

module.exports = {

    async tick(context) {

        const { connectionid } = context.properties;
        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const params = {
            'filters[state]': STATE_ABANDONED,
            'orders[external_created_date]': 'DESC'
        };
        if (connectionid) {
            params['filters[connectionid]'] = connectionid;
        }

        const orders = await ac.getEcomOrders(params);

        const state = await context.loadState();
        // On the first tick we only initialize the known set to avoid emitting the whole backlog.
        const known = Array.isArray(state.known) ? new Set(state.known) : null;
        const currentIds = orders.map(order => String(order.id));

        if (known) {
            const fresh = orders.filter(order => !known.has(String(order.id)));
            await Promise.all(fresh.map(order => context.sendJson(order, 'out')));
        }

        await context.saveState({ known: currentIds });
    },

    // Flow Test Mode: emit the most recent abandoned cart without starting the flow.
    async test(context) {

        const { connectionid } = context.properties;
        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const params = {
            'filters[state]': STATE_ABANDONED,
            'orders[external_created_date]': 'DESC',
            limit: 1
        };
        if (connectionid) {
            params['filters[connectionid]'] = connectionid;
        }

        const orders = await ac.getEcomOrders(params);

        if (!orders.length) {
            throw new Error('No abandoned carts to use as test data.');
        }

        return context.sendJson(orders[0], 'out');
    }
};
