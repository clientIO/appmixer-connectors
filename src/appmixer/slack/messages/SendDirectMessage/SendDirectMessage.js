'use strict';

const lib = require('../../lib');
const { WebClient } = require('@slack/web-api');

module.exports = {

    async receive(context) {

        let { text, userIds } = context.messages.in.content;
        if (userIds.length > 8) {
            throw new context.CancelError('You can send a message to a maximum of 8 users at once');
        }
        let ids = userIds?.join(',');

        // First, open a conversation with the user(s). It will return the channel ID.
        const web = new WebClient(context.auth.accessToken);
        const response = await web.conversations.open({ users: ids, prevent_creation: true });

        if (!response?.channel?.id) {
            const errorDetails = JSON.stringify({ channel: response.channel, userIds });
            throw new context.CancelError('Could not open a conversation with a user. Details: ' + errorDetails);
        }

        // Then, send the message to the channel.
        const message = await lib.sendMessage(context, response.channel.id, text, false);

        return context.sendJson(message, 'out');
    }
};

