'use strict';

const { WebClient } = require('@slack/web-api');

module.exports = {

    async receive(context) {

        const { channel, ts } = context.messages.in.content;

        if (!channel) {
            throw new context.CancelError('Channel is required!');
        }
        if (!ts) {
            throw new context.CancelError('Message Timestamp is required!');
        }

        const web = new WebClient(context.auth.accessToken);
        await web.chat.delete({ channel, ts });

        return context.sendJson({}, 'out');
    }
};
