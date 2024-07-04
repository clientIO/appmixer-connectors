'use strict';

const commons = require('../../slack-commons');
const { SlackAPIError } = require('../../errors');

module.exports = {

    async receive(context) {

        const { channel, text, ts } = context.messages.in.content;
        const client = commons.getSlackAPIClient(context.auth.accessToken);

        try {
            const result = await client.updateMessage(channel, text, ts);
            return context.sendJson(result, 'out');
        } catch (err) {
            if (err instanceof SlackAPIError) {
                throw new context.CancelError(err.apiError);
            }
            throw err;
        }
    }
};
