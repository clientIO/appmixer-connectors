'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { sessionId } = context.messages.in.content;

        if (!sessionId) {
            throw new context.CancelError('Session ID is required!');
        }

        await lib.apiRequest(context, {
            method: 'DELETE',
            path: `/sessions/${encodeURIComponent(sessionId)}`
        });

        return context.sendJson({}, 'out');
    }
};
