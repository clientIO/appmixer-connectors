'use strict';

module.exports = {

    async start(context) {

        const componentName = context.flowDescriptor[context.componentId].label || 'New Channel Message';

        if (!context.config?.authToken) {
            throw new Error(`Missing Slack configuration for component: ${componentName}. Please configure the "authToken" with a valid Slack App token.`);
        }

        if (!context.config.signingSecret) {
            throw new Error(`Missing Slack configuration for component: ${componentName}. Please configure the "signingSecret" with a valid Slack App signing secret.`);
        }

        return context.addListener(context.properties.channelId, { accessToken: context.auth.accessToken } );
    },

    async stop(context) {

        return context.removeListener(context.properties.channelId);
    },

    async receive(context) {

        if (context.messages.webhook) {
            if (context.properties.ignoreBotMessages && context.messages.webhook.content.data.subtype === 'bot_message') {
                // Ignore bot messages.
                return;
            }
            await context.sendJson(context.messages.webhook.content.data, 'message');
        }
    }
};
