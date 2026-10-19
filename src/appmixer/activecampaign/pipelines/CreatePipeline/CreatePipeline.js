'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const { trimUndefined } = require('../../helpers');

module.exports = {

    async receive(context) {

        const { title, currency } = context.messages.in.content;
        if (!title) {
            throw new context.CancelError('Title is required');
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const payload = {
            dealGroup: trimUndefined({
                title,
                currency: (currency || 'usd').toLowerCase()
            })
        };

        const { data } = await ac.call('post', 'dealGroups', payload);
        const { dealGroup } = data;

        return context.sendJson(dealGroup, 'out');
    }
};
