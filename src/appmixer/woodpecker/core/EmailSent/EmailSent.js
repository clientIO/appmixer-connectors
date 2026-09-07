'use strict';

const lib = require('../../lib');

const EVENT = 'campaign_sent';

module.exports = {

    async start(context) {
        const companyId = context.profileInfo?.companyId;
        if (!companyId) {
            throw new context.CancelError('Woodpecker account is missing a company id — reconnect the account.');
        }
        return context.addListener(`${EVENT}:${companyId}`, {
            apiKey: context.auth.apiKey,
            companyId,
            event: EVENT
        });
    },

    async stop(context) {
        const companyId = context.profileInfo?.companyId;
        return context.removeListener(`${EVENT}:${companyId}`);
    },

    async receive(context) {
        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'out');
        }
    },

    // Flow Test Mode: emit one realistic event payload without registering the webhook.
    async test(context) {
        const example = await lib.fetchLatestExample(context, EVENT);
        if (!example) {
            throw new context.CancelError('No prospects available to build a test example.');
        }
        return context.sendJson(example, 'out');
    }
};
