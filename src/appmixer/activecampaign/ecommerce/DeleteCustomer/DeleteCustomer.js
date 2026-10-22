'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { customerId } = context.messages.in.content;
        if (!customerId) {
            throw new context.CancelError('Customer is required');
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        try {
            await ac.call('delete', `ecomCustomers/${customerId}`);
        } catch (e) {
            if (e.response?.status !== 404) {
                throw (e);
            }
        }

        return context.sendJson({}, 'out');
    }
};
