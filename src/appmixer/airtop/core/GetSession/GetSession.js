'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { sessionId } = context.messages.in.content;

        if (!sessionId) {
            throw new context.CancelError('Session ID is required!');
        }

        const { data } = await lib.apiRequest(context, {
            method: 'GET',
            path: `/sessions/${encodeURIComponent(sessionId)}`
        });

        const session = lib.unwrap(context, data);

        return context.sendJson({
            id: session.id,
            status: session.status,
            dateCreated: session.dateCreated,
            lastActivity: session.lastActivity,
            currentUsage: session.currentUsage,
            cdpUrl: session.cdpUrl,
            cdpWsUrl: session.cdpWsUrl,
            chromedriverUrl: session.chromedriverUrl
        }, 'out');
    }
};
