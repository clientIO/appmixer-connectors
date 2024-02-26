'use strict';
const commons = require('../../slack-commons');
const { SlackAPIError } = require('../../errors');

/**
 * Component for fetching list of public channels.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let client = commons.getSlackAPIClient(context.auth.accessToken);
        const options = { 'exclude_archived': 1, 'types': 'public_channel', limit: 1000 };

        try {
            const channels = await client.listChannels(options);
            return context.sendJson(channels, 'channels');
        } catch (err) {
            if (err instanceof SlackAPIError) {
                throw new context.CancelError(err.apiError);
            }
            throw err;
        }
    }
};
