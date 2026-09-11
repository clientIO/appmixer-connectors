'use strict';

const { WebClient } = require('@slack/web-api');
const Entities = require('html-entities').AllHtmlEntities;

module.exports = {

    async receive(context) {

        if (!context.messages.in.content.channel) {
            throw new context.CancelError('Channel is required!');
        }
        if (!context.messages.in.content.text) {
            throw new context.CancelError('Message Text is required!');
        }
        if (!context.messages.in.content.ts) {
            throw new context.CancelError('Message Timestamp is required!');
        }

        const { channel, text, ts } = context.messages.in.content;

        let entities = new Entities();
        const web = new WebClient(context.auth.accessToken);

        const result = await web.chat.update({
            channel,
            text: entities.decode(text),
            ts
        });

        return context.sendJson(result, 'out');
    }
};
