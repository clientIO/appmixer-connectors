'use strict';
const commons = require('../../docusign-commons');

/**
 * Get an envelope.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        const { events } = context.properties;
        const { base_uri: basePath, account_id: accountId } = context.profileInfo.accounts[0];
        let args = {
            basePath,
            accountId,
            events
        };
        // eslint-disable-next-line max-len
        const { connectId } = await commons.registerDocusignWebhook(args, context.auth.accessToken, context.getWebhookUrl());
        await context.saveState({ connectId });
    },

    async stop(context) {

        const { base_uri: basePath, account_id: accountId } = context.profileInfo.accounts[0];
        let args = {
            basePath,
            accountId
        };
        return commons.unregisterDocusignWebhook(args, context.auth.accessToken, context.state.connectId);
    },

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'out');
            return context.response({});
        }
    }
};
