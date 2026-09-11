'use strict';

const { WebClient } = require('@slack/web-api');

/**
 * Component which creates new private channel.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (!context.messages.channel.content.name) {
            throw new context.CancelError('Channel name is required!');
        }

        let channel = context.messages.channel.content;
        const web = new WebClient(context.auth.accessToken);

        const { channel: createdChannel } = await web.conversations.create({
            name: channel.name,
            is_private: true
        });
        return context.sendJson(createdChannel, 'newChannel');
    }
};

