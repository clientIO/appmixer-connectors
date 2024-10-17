'use strict';
const commons = require('../../lib');
const { SlackAPIError } = require('../../errors');

/**
 * Component which creates new private channel.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let channel = context.messages.channel.content;
        let client = commons.getSlackAPIClient(context.auth.accessToken);

        try {
            const createdChannel = await client.createChannel(channel.name, true);
            return context.sendJson(createdChannel, 'newChannel');
        } catch (err) {
            if (err instanceof SlackAPIError) {
                throw new context.CancelError(err.apiError);
            }
            throw err;
        }
    }
};

