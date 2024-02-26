'use strict';
const moment = require('moment');
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    start(context) {

        return this.registerWebhook(context);
    },

    async registerWebhook(context) {

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        const { data } = await ac.registerWebhook('AppmixerUpdatedDealWebhook', context.getWebhookUrl(), [
            'deal_update'
        ]);

        return context.saveState({ webhookId: data.webhook.id });
    },

    stop(context) {

        return this.unregisterWebhook(context);
    },

    async unregisterWebhook(context) {

        const { webhookId } = await context.loadState();
        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);
        return ac.unregisterWebhook(webhookId);
    },

    async receive(context) {

        const { auth } = context;
        if (context.messages.webhook) {
            const { data } = context.messages.webhook.content;
            const id = data['deal[id]'];

            const ac = new ActiveCampaign(auth.url, auth.apiKey);

            const { data: getContact } = await ac.call('get', `deals/${id}`);
            const { deal } = getContact;

            const dealInfo = {
                id,
                owner: deal.owner,
                contactId: deal.contact,
                organization: deal.organization,
                group: deal.group,
                stage: deal.stage,
                title: deal.title,
                description: deal.description,
                createdDate: moment(deal.cdate).toISOString(),
                value: deal.value / 100,
                currency: deal.currency,
            }

            const { fieldValues = [] } = getContact;
            if (fieldValues.length > 0) {
                fieldValues.forEach(field => {
                    dealInfo[`customField_${field}`] = field.value;
                });
            }

            await context.sendJson(dealInfo, 'deal');
            return context.response();
        }
    }
};
