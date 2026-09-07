'use strict';

const lib = require('../../lib');

module.exports = {

    async tick(context) {

        const allNotifications = await lib.listAllNotifications(context);

        const follows = allNotifications.filter(n => n.reason === 'follow');

        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, follows, 'uri');

        for (const follow of diff) {
            await context.sendJson(follow, 'out');
        }
        await context.saveState({ known: actual });
    },

    async test(context) {

        const follow = await lib.fetchLatestNotification(context, 'follow');
        if (!follow) {
            throw new Error('No recent follow notifications to use as test data.');
        }
        return context.sendJson(follow, 'out');
    }
};
