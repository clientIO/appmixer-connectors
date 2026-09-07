'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async tick(context) {

        const { connectionid } = context.properties;
        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const params = {
            'orders[updated_date]': 'DESC'
        };

        if (connectionid) {
            params['filters[connectionid]'] = connectionid;
        }

        const orders = await ac.getEcomOrders(params);

        const state = await context.loadState();
        const previousStatuses = state.statuses || {};
        const nextStatuses = {};
        const hadState = Object.keys(previousStatuses).length > 0;

        const changed = [];
        for (const order of orders) {
            const id = String(order.id);
            const currentState = String(order.state);
            nextStatuses[id] = currentState;

            const previousState = previousStatuses[id];
            // Emit only when an already-known order changed its state.
            if (previousState !== undefined && previousState !== currentState) {
                changed.push({ ...order, previousState });
            }
        }

        // On the first tick we only initialize the status map to avoid false positives.
        if (hadState) {
            await Promise.all(changed.map(order => context.sendJson(order, 'out')));
        }

        await context.saveState({ statuses: nextStatuses });
    },

    // Flow Test Mode: emit the most recently updated order without starting the flow.
    async test(context) {

        const { connectionid } = context.properties;
        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const params = {
            'orders[updated_date]': 'DESC',
            limit: 1
        };
        if (connectionid) {
            params['filters[connectionid]'] = connectionid;
        }

        const orders = await ac.getEcomOrders(params);

        if (!orders.length) {
            throw new Error('No orders to use as test data.');
        }

        const order = orders[0];
        return context.sendJson({ ...order, previousState: String(order.state) }, 'out');
    }
};
