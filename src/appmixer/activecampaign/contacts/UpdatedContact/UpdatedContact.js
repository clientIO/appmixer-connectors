'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const commons = require('../../activecampaign-commons');

module.exports = {

    async test(context) {

        const contact = await commons.fetchLatestContact(context, 'udate');
        if (!contact) {
            throw new context.CancelError('No recent contacts to use as test data.');
        }
        return context.sendJson(contact, 'contact');
    },

    start(context) {

        return this.registerWebhook(context);
    },

    async registerWebhook(context) {

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const { data } = await ac.registerWebhook(context.getWebhookUrl(), context.getWebhookUrl(), [
            'update'
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
            const id = data['contact[id]'];

            const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

            try {
                const { data: getContact } = await ac.call('get', `contacts/${id}`);
                const { contact: contactInfo, fieldValues = [] } = getContact;

                await context.sendJson(commons.reshapeContact(contactInfo, fieldValues), 'contact');
                return context.response();
            } catch (err) {
                // Ignore when the contact does not exist anymore
                if (err.response.status !== 404) {
                    throw err;
                }
            }

        }
    }
};
