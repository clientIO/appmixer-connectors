'use strict';
const commons = require('../../slack-commons');
const { SlackAPIError } = require('../../errors');

/**
 * Component which creates new public channel.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let channel = context.messages.channel.content;
        let client = commons.getSlackAPIClient(context.auth.accessToken);

        try {
            const createdChannel = await client.createChannel(channel.name);
            return context.sendJson(createdChannel, 'newChannel');
        } catch (err) {
            if (err instanceof SlackAPIError) {
                throw new context.CancelError(err.apiError);
            }
            throw err;
        }
    }
};

