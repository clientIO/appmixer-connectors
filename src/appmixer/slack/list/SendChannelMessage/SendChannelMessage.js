'use strict';
const commons = require('../../slack-commons');
const { SlackAPIError } = require('../../errors');

/**
 * Component which sends new message to public channel.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { channelId, text } = context.messages.message.content;
        const client = commons.getSlackAPIClient(context.auth.accessToken);

        try {
            const message = await client.sendMessage(channelId, text);
            return context.sendJson(message, 'newMessage');
        } catch (err) {
            if (err instanceof SlackAPIError) {
                throw new context.CancelError(err.apiError);
            }
            throw err;
        }
    }
};
