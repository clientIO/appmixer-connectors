'use strict';

const { WebClient } = require('@slack/web-api');
const Entities = require('html-entities').AllHtmlEntities;

module.exports = {

    async receive(context) {

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
