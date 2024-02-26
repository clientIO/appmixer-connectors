'use strict';
const request = require('request-promise');
const Promise = require('bluebird');


module.exports = {

    async receive(context) {

        const { teamId } = context.messages.in.content;
        const { accessToken } = context.auth;
        const response = await request({
            method: 'GET',
            url: 'https://graph.microsoft.com/v1.0/teams/' + teamId + '/channels',
            body: {},
            auth: { bearer: accessToken },
            headers: { 'Accept': 'application/json' },
            json: true
        });

        const channels = response.value || [];
        return context.sendJson(channels, 'out');
    },

    channelsToSelectArray(message) {

        const transformed = [];
        if (!message || !Array.isArray(message)) {
            return transformed;
        }

        message.forEach(channelItem => {

            transformed.push({
                label: channelItem.displayName,
                value: channelItem.id
            });
        });

        return transformed;
    }
};
