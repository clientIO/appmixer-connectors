/* eslint-disable camelcase */
'use strict';

const { WebClient } = require('@slack/web-api');
const Entities = require('html-entities').AllHtmlEntities;

/**
 * Component which triggers whenever new message is added to private channel.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {


        // Timestamp in seconds - needed for endpoint call. Endpoint supports decimals, hence we don't
        // need to round
        let since = new Date().valueOf() / 1000;

        let { channelId } = context.properties;
        const web = new WebClient(context.auth.accessToken);
        let entities = new Entities();

        const state = await context.loadState();

        const sinceToCompare = state.since || since;


        let { messages, has_more, response_metadata } = await web.conversations.history({
            channel: channelId, oldest: sinceToCompare, limit: 1000
        });


        if (response_metadata?.next_cursor) {
            options.cursor = response_metadata.next_cursor;
        }

        // If there are more messages, we need to fetch them
        if (has_more) {
            let i = 0;
            let safeguard = 10;
            while (has_more && i < safeguard) {
                i++;
                const nextResponse = await web.conversations.history({
                    channel: channelId, oldest: sinceToCompare, limit: 1000, cursor: options.cursor
                });
                messages.push(...nextResponse.messages);
                has_more = nextResponse.has_more;
                if (nextResponse.response_metadata?.next_cursor) {
                    options.cursor = nextResponse.response_metadata.next_cursor;
                }
                if (!has_more) {
                    break;
                }
            }
        }

        // Order the messages retrieved from latest to oldest
        messages.reverse();

        await Promise.all(messages.map(async (message) => {
            message['text'] = entities.decode(message['text']);
            await context.sendJson(message, 'message');
        }));


        await context.saveState({ since });
    }
};

