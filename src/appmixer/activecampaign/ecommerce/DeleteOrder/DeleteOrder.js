'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { orderId } = context.messages.in.content;
        if (!orderId) {
            throw new context.CancelError('Order is required');
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        try {
            await ac.call('delete', `ecomOrders/${orderId}`);
        } catch (e) {
            if (e.response?.status !== 404) {
                throw (e);
            }
        }

        return context.sendJson({}, 'out');
    }
};
