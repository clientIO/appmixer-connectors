'use strict';

const lib = require('../../lib');

module.exports = {

    async tick(context) {

        const allNotifications = await lib.listAllNotifications(context);

        const replies = allNotifications.filter(n => n.reason === 'reply');

        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, replies, 'uri');

        for (const reply of diff) {
            await context.sendJson(reply, 'out');
        }
        await context.saveState({ known: actual });
    },

    async test(context) {

        const reply = await lib.fetchLatestNotification(context, 'reply');
        if (!reply) {
            throw new Error('No recent reply notifications to use as test data.');
        }
        return context.sendJson(reply, 'out');
    }
};
