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

        const { data } = await ac.registerWebhook(context.getWebhookUrl(), context.getWebhookUrl(), [
            'subscribe'
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
            const id = data['contact[id]'];

            const ac = new ActiveCampaign(auth.url, auth.apiKey);

            try {
                const { data: getContact } = await ac.call('get', `contacts/${id}`);
                const { contact: contactInfo } = getContact;

                const contact = {
                    id,
                    email: contactInfo.email,
                    firstName: contactInfo.firstName,
                    lastName: contactInfo.lastName,
                    phone: contactInfo.phone,
                    createdDate: moment(contactInfo.cdate).toISOString()
                };

                const { fieldValues = [] } = getContact;
                if (fieldValues.length > 0) {
                    fieldValues.forEach(field => {
                        contact[`customField_${field.field}`] = field.value;
                    });
                }

                await context.sendJson(contact, 'contact');
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
