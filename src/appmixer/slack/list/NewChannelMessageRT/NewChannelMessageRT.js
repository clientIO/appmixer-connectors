'use strict';

module.exports = {

    async start(context) {

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
