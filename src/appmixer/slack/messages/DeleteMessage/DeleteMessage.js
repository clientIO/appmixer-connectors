'use strict';

const commons = require('../../slack-commons');
const { SlackAPIError } = require('../../errors');

module.exports = {

    async receive(context) {

        const { channel, ts } = context.messages.in.content;
        const client = commons.getSlackAPIClient(context.auth.accessToken);

        try {
            const createdChannel = await client.deleteMessage(channel, ts);
            return context.sendJson(createdChannel, 'newChannel');
        } catch (err) {
            if (err instanceof SlackAPIError) {
                throw new context.CancelError(err.apiError);
            }
            throw err;
        }
    }
};
