'use strict';

module.exports = {

    async start(context) {

        if (!context.config?.authToken) {
            throw new Error('Missing Slack configuration. Please configure the `authToken` with a valid Slack App token.');
        }

        return context.addListener(context.properties.channelId, { accessToken: context.auth.accessToken } );
    },

    async stop(context) {

        return context.removeListener(context.properties.channelId);
    },

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'message');
        }
    }
};
