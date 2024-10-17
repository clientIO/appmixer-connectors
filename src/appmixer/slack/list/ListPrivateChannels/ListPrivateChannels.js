'use strict';
const commons = require('../../lib');
const { SlackAPIError } = require('../../errors');

/**
 * Component for fetching list of private channels.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let client = commons.getSlackAPIClient(context.auth.accessToken);
        const options = { 'exclude_archived': 1, 'types': 'private_channel', limit: 1000 };

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
