'use strict';

const { makeRequest } = require('../commons');

module.exports = {

    async receive(context) {

        const { teamId, channelId, content } = context.messages.in.content;

        if (!teamId) {
            throw new context.CancelError('Team is required!');
        }
        if (!channelId) {
            throw new context.CancelError('Channel is required!');
        }
        if (!content) {
            throw new context.CancelError('Content is required!');
        }

        const { data } = await makeRequest(context, {
            method: 'POST',
            path: `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,
            data: { body: { content } }
        });

        return context.sendJson(data, 'out');
    }
};
