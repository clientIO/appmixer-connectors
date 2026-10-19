'use strict';

const { WebClient } = require('@slack/web-api');

module.exports = {

    /**
     * @link https://api.slack.com/methods/reactions.get
     */
    async receive(context) {

        const { channel, timestamp } = context.messages.in.content;

        if (!channel) {
            throw new context.CancelError('Channel is required!');
        }
        if (!timestamp) {
            throw new context.CancelError('Message Timestamp is required!');
        }

        // Initialize Slack Web API client
        const web = new WebClient(context.auth.accessToken);
        const result = await web.reactions.get({ channel, timestamp, full: true });

        return context.sendJson(result, 'out');
    }
};
