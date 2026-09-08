'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { meetingId } = context.messages.in.content;

        if (!meetingId) {
            throw new context.CancelError('Meeting ID is required!');
        }

        const { data } = await lib.apiRequest(context, {
            method: 'GET',
            path: `/${lib.API_VERSION}/meetings/${encodeURIComponent(meetingId)}/notes`
        });

        return context.sendJson(data, 'out');
    }
};
