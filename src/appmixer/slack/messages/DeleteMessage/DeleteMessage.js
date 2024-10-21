'use strict';

const { WebClient } = require('@slack/web-api');

module.exports = {

    async receive(context) {

        const { channel, ts } = context.messages.in.content;
        const web = new WebClient(context.auth.accessToken);
        const createdChannel = await web.chat.delete({ channel, ts });

        return context.sendJson(createdChannel, 'out');
    }
};
