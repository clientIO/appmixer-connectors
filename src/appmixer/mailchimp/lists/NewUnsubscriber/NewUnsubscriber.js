'use strict';

const mailchimpDriver = require('../../commons');

module.exports = {

    async start(context) {

        await mailchimpDriver.lists.registerWebhook(context, {
            subscribe: false,
            unsubscribe: true,
            profile: false
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

        if (data?.type === 'unsubscribe') {
            const unSubscriberData = mailchimpDriver.parseData(data);
            await context.sendJson(unSubscriberData, 'out');
        }
    },

    async test(context) {

        // No webhook registration: fetch the newest unsubscribed member of the list and
        // reshape it into the same body an 'unsubscribe' webhook delivers (parseData output).
        const { listId } = context.properties;
        if (!listId) {
            throw new context.CancelError('List ID is required!');
        }
        const member = await mailchimpDriver.getLatestMember(context, listId, 'unsubscribed');
        if (!member) {
            throw new Error('No unsubscribed members in the list to use as test data.');
        }
        return context.sendJson(mailchimpDriver.toSubscriberWebhookShape(member, listId, 'unsubscribe'), 'out');
    }

};
