/* eslint-disable camelcase */
'use strict';
const { WebClient } = require('@slack/web-api');

/**
 * Component for fetching list of channels.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { types = 'public_channel,private_channel' } = context.messages.in.content;
        const web = new WebClient(context.auth.accessToken);
        const { channels, response_metadata } = await web.conversations.list({
            limit: 999,
            types,
            exclude_archived: true
        });

        let metadata = response_metadata;
        if (metadata?.next_cursor) {
            let i = 0;
            let safeguard = 10;
            while (metadata?.next_cursor && i < safeguard) {
                i++;
                const nextResponse = await web.conversations.list({
                    limit: 999,
                    types,
                    exclude_archived: true,
                    cursor: metadata.next_cursor
                });
                channels.push(...nextResponse.channels);
                metadata = nextResponse.response_metadata;

                if (!metadata?.next_cursor) {
                    break;
                }
            }
        }

        return context.sendJson(channels, 'channels');
    },

    channelsToSelectArray(channels) {

        let transformed = [];

        if (Array.isArray(channels)) {
            channels.forEach(channel => {

                if (channel['is_member']) {
                    transformed.push({
                        label: channel['name'],
                        value: channel['id']
                    });
                }
            });
        }

        return transformed;
    }
};
