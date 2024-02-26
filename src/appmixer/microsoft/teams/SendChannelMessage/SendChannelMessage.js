'use strict';
const request = require('request-promise');

module.exports = {

    async receive(context) {

        const { teamId, channelId, content } = context.messages.in.content;
        const { accessToken } = context.auth;
        const response = await request({
            method: 'POST',
            url: 'https://graph.microsoft.com/v1.0/teams/' + teamId + '/channels/' + channelId + '/messages',
            body: {
                body: {
                    content: content
                }
            },
            auth: { bearer: accessToken },
            headers: { 'Accept': 'application/json' },
            json: true
        });

        return context.sendJson(response, 'out');
    }
};

