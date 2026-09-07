'use strict';

const { WebClient } = require('@slack/web-api');

module.exports = {

    async start(context) {

        const componentName = context.flowDescriptor[context.componentId].label || 'New User';

        if (!context.config.signingSecret) {
            throw new Error(`Missing Slack configuration for component: ${componentName}. Please configure the "signingSecret" with a valid Slack App signing secret.`);
        }

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
    },

    // Flow Test Mode: emit one realistic user without registering the app webhook. The
    // team_join listener delivers the raw Slack user object, so fetching the most recently
    // updated active member via users.list produces the same shape receive() emits.
    async test(context) {

        const web = new WebClient(context.auth.accessToken);
        const { members } = await web.users.list({ limit: 999 });

        const sample = (members || [])
            .filter(member => !member.deleted)
            .sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
        if (!sample) {
            throw new Error('No users to use as test data.');
        }
        return context.sendJson(sample, 'user');
    }
};
