'use strict';

const lib = require('../../lib');

module.exports = {

    async tick(context) {

        const allNotifications = await lib.listAllNotifications(context);

        const mentions = allNotifications.filter(n => n.reason === 'mention');

        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, mentions, 'uri');

        for (const mention of diff) {
            await context.sendJson(mention, 'out');
        }
        await context.saveState({ known: actual });
    },

    async test(context) {

        const mention = await lib.fetchLatestNotification(context, 'mention');
        if (!mention) {
            throw new Error('No recent mention notifications to use as test data.');
        }
        return context.sendJson(mention, 'out');
    }
};
