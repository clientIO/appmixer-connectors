'use strict';

module.exports = {

    async start(context) {

        const componentName = context.flowDescriptor[context.componentId].label || 'New User';

        if (!context.config.signingSecret) {
            throw new Error(`Missing Slack configuration for component: ${componentName}. Please configure the "signingSecret" with a valid Slack App signing secret.`);
        }
    },

    async stop(context) {

        return context.removeListener('slack_team_join');
    },

    async receive(context) {

        if (context.messages.webhook) {
            // `data` contains `user` object from Slack API
            await context.sendJson(context.messages.webhook.content.data, 'user');
        }
    }
};
