'use strict';

const mailchimpDriver = require('../../commons');


module.exports = {

    async start(context) {

        await mailchimpDriver.lists.registerWebhook(context, {
            subscribe: true
        });
    },

    async stop(context) {

        await mailchimpDriver.lists.unregisterWebhook(context);
    },

    async receive(context) {

        const { headers = {}, data } = context.messages.webhook.content;

        if (headers['user-agent'] === 'MailChimp.com WebHook Validator') {
            return context.response('', 200);
        }

        if (data?.type === 'subscribe') {
            const subscriberData = mailchimpDriver.parseData(data);
            await context.sendJson(subscriberData, 'out');
        }
    },

    async test(context) {

        // No webhook registration: fetch the newest subscribed member of the list and
        // reshape it into the same body a 'subscribe' webhook delivers (parseData output).
        const { listId } = context.properties;
        if (!listId) {
            throw new context.CancelError('List ID is required!');
        }
        const member = await mailchimpDriver.getLatestMember(context, listId, 'subscribed');
        if (!member) {
            throw new Error('No subscribers in the list to use as test data.');
        }
        return context.sendJson(mailchimpDriver.toSubscriberWebhookShape(member, listId, 'subscribe'), 'out');
    }
};
