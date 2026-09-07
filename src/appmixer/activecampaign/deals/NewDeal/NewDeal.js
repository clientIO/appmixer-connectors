'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const commons = require('../../activecampaign-commons');

module.exports = {

    async test(context) {

        const deal = await commons.fetchLatestDeal(context, 'cdate');
        if (!deal) {
            throw new context.CancelError('No recent deals to use as test data.');
        }
        return context.sendJson(deal, 'deal');
    },

    start(context) {

        return this.registerWebhook(context);
    },

    async registerWebhook(context) {

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const { data } = await ac.registerWebhook(context.getWebhookUrl(), context.getWebhookUrl(), [
            'deal_add'
        ]);

        return context.saveState({ webhookId: data.webhook.id });
    },

    stop(context) {

        return this.unregisterWebhook(context);
    },

    async unregisterWebhook(context) {

        const { webhookId } = await context.loadState();
        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);
        return ac.unregisterWebhook(webhookId);
    },

    async receive(context) {

        const { auth } = context;
        if (context.messages.webhook) {
            const { data } = context.messages.webhook.content;
            const id = data['deal[id]'];

            const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

            const { data: getDeal } = await ac.call('get', `deals/${id}`);
            const { deal, fieldValues = [] } = getDeal;

            await context.sendJson(commons.reshapeDeal(deal, fieldValues), 'deal');
            return context.response();
        }
    }
};
