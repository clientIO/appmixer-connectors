'use strict';

const { WebClient } = require('@slack/web-api');

module.exports = {

    async receive(context) {

        const { channel, timestamp, name } = context.messages.in.content;

        if (!channel) {
            throw new context.CancelError('Channel is required!');
        }
        if (!timestamp) {
            throw new context.CancelError('Message Timestamp is required!');
        }
        if (!name) {
            throw new context.CancelError('Reaction Name is required!');
        }

        // Initialize Slack Web API client
        const web = new WebClient(context.auth.accessToken);
        await web.reactions.remove({
            channel,
            timestamp,
            name
        });

        return context.sendJson({}, 'out');
    }
};
