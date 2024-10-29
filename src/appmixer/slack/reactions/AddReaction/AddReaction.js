'use strict';

const { WebClient } = require('@slack/web-api');

module.exports = {

    async receive(context) {

        const { channel, timestamp, name, isSource } = context.messages.in.content;
        if (isSource) {
            await listAllChannels(context);
            return;
        }
        // Initialize Slack Web API client
        const web = new WebClient(context.auth.accessToken);
        const result = await web.reactions.add({
            channel,
            timestamp,
            name
        });

        return context.sendJson(result, 'out');
    }
};

/**
 * List all channels: private, public, direct messages, and group messages.
 * Similar to ListChannels.js with channelsToSelectArray function. This also lists direct messages and group messages.
 */
async function listAllChannels(context) {

    const client = new WebClient(context.auth.accessToken);
    const options = { exclude_archived: 1, types: 'private_channel,public_channel,im,mpim', limit: 1000 };

    try {
        const channels = await client.conversations.list(options);
        const myChannels = channels.channels?.filter(channel => channel.is_member).map(channel => {
            return {
                label: channel.name,
                value: channel.id
            };
        });
        context.sendJson(myChannels, 'out');
    } catch (err) {
        context.log({ step: 'List channels error', error: err });
        context.sendJson([], 'out');
    }
}
