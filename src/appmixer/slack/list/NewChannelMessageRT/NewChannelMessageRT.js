'use strict';

const { WebClient } = require('@slack/web-api');
const Entities = require('html-entities').AllHtmlEntities;

module.exports = {

    async start(context) {

        const componentName = context.flowDescriptor[context.componentId].label || 'New Channel Message';

        if (!context.config?.authToken && !context.config?.usesAuthHub) {
            throw new Error(`Missing Slack configuration for component: ${componentName}. Please configure the "authToken" with a valid Slack App token.`);
        }

        if (!context.config?.signingSecret && !context.config?.usesAuthHub) {
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
    },

    // Flow Test Mode: emit one realistic channel message without registering the app webhook.
    // This plugin trigger normally receives events via context.addListener; test() instead fetches
    // the latest message through the same Slack conversations.history call the polling
    // NewChannelMessage trigger uses, and honors the same ignoreBotMessages filter as receive().
    async test(context) {

        const { channelId, ignoreBotMessages } = context.properties;
        const web = new WebClient(context.auth.accessToken);

        const { messages } = await web.conversations.history({ channel: channelId, limit: 1 });
        const sample = (messages || [])[0];
        if (!sample) {
            throw new Error('No recent messages in the channel to use as test data.');
        }
        if (ignoreBotMessages && sample.subtype === 'bot_message') {
            throw new Error('The most recent message is a bot message.');
        }

        sample.text = new Entities().decode(sample.text);
        return context.sendJson(sample, 'message');
    }
};
