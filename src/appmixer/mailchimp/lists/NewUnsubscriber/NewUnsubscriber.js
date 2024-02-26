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

        if (data && data.type === 'unsubscribe') {
            const unSubscriberData = mailchimpDriver.parseData(data);
            await context.sendJson(unSubscriberData, 'out');
        }
    }

};
