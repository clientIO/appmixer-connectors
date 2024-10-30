'use strict';

module.exports = {

    async start(context) {

        return context.addListener('slack_team_join', { accessToken: context.auth.accessToken });
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
