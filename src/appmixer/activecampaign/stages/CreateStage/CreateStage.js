'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const { trimUndefined } = require('../../helpers');

module.exports = {

    async receive(context) {

        const { title, group, color, order } = context.messages.in.content;
        if (!title) {
            throw new context.CancelError('Title is required');
        }
        if (!group) {
            throw new context.CancelError('Pipeline is required');
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const payload = {
            dealStage: trimUndefined({
                title,
                group,
                color: color || 'a6b1e1',
                order: order ? Number(order) : 1
            })
        };

        const { data } = await ac.call('post', 'dealStages', payload);
        const { dealStage } = data;

        return context.sendJson(dealStage, 'out');
    }
};
