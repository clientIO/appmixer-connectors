'use strict';
const commons = require('../../slack-commons');
const Promise = require('bluebird');
const Entities = require('html-entities').AllHtmlEntities;
const { SlackAPIError } = require('../../errors');

/**
 * Component which triggers whenever new message is added to public channel.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        // Timestamp in seconds - needed for endpoint call. Endpoint supports decimals, hence we don't
        // need to round
        let since = new Date().valueOf() / 1000;

        let { channelId } = context.properties;
        let client = commons.getSlackAPIClient(context.auth.accessToken);
        let entities = new Entities();

        const state = await context.loadState();

        const sinceToCompare = state.since || since;

        let messages;

        try {
            const options = { oldest: sinceToCompare };
            messages = await client.listMessages(channelId, options, 1000);
        } catch (err) {
            if (err instanceof SlackAPIError) {
                throw new context.CancelError(err.apiError);
            }
            throw err;
        }

        // Order the messages retrieved from latest to oldest
        messages.reverse();

        await Promise.map(messages, (message) => {
            message['text'] = entities.decode(message['text']);
            return context.sendJson(message, 'message');
        });

        await context.saveState({ since });
    }
};

