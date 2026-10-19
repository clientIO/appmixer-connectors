'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const { trimUndefined } = require('../../helpers');

module.exports = {

    async receive(context) {

        const { connectionid, externalid, email, acceptsMarketing } = context.messages.in.content;
        if (!connectionid) {
            throw new context.CancelError('Connection ID is required');
        }
        if (!externalid) {
            throw new context.CancelError('External ID is required');
        }
        if (!email) {
            throw new context.CancelError('Email is required');
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const payload = { ecomCustomer: trimUndefined({ connectionid, externalid, email, acceptsMarketing }) };
        const { data } = await ac.call('post', 'ecomCustomers', payload);

        return context.sendJson(data.ecomCustomer, 'out');
    }
};
