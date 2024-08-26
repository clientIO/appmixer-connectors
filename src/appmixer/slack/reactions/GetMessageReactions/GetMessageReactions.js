'use strict';

const { WebClient } = require('@slack/web-api');

module.exports = {

    async receive(context) {

        const { channel, timestamp } = context.messages.in.content;

        // Initialize Slack Web API client
        const web = new WebClient(context.auth.accessToken);
        const result = await web.reactions.get({ channel, timestamp });

        return context.sendJson(result, 'out');
    }
};
