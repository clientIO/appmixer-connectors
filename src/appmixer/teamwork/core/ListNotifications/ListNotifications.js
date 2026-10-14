'use strict';

const lib = require('../../lib');

module.exports = {
    receive: async function(context) {
        let {
            daysAgo,
            orderMode,
            limit,
            unreadOnly,
            notifiedOnly,
            fromUsers,
        } = context.messages.in.content;

        let q = {
            updatedAfter: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
            orderMode,
            limit,
            unreadOnly,
            notifiedOnly,
            fromUsers: Array.isArray(fromUsers) ? fromUsers.join(',') : undefined,
        }

        let resp = await lib.callAPI(
            context, 
            "GET",
            '/projects/api/v3/notifications.json',
            null,
            q,
        )

        return context.sendJson(resp, 'notifications');
    }
}
