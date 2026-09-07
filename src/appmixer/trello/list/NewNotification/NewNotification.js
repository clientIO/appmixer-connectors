'use strict';
const commons = require('../../trello-commons');

/**
 * Process notifications to find newly added.
 * @param {Set} knownNotifications
 * @param {Set} actualNotifications
 * @param {Set} newNotifications
 * @param {Object} notification
 */
function processNotifications(knownNotifications, actualNotifications, newNotifications, notification) {

    if (knownNotifications && !knownNotifications.has(notification['id'])) {
        newNotifications.add(notification);
    }
    actualNotifications.add(notification['id']);
}

/**
 * Component which triggers whenever new notification is in Trello
 * @extends {Component}
 */
const NOTIFICATIONS_URL = '/1/members/me/notifications';

module.exports = {

    async tick(context) {

        const res = await commons.fetchAll(context, NOTIFICATIONS_URL);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.forEach(processNotifications.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.all(Array.from(diff).map(notification => {
                return context.sendJson(notification, 'notification');
            }));
        }
        await context.saveState({ known: Array.from(actual) });
    },

    async test(context) {

        // Same notifications listing as tick().
        const res = await commons.fetchAll(context, NOTIFICATIONS_URL);
        const latest = commons.pickLatestById(res);
        if (!latest) {
            throw new Error('No recent notifications to use as test data.');
        }
        return context.sendJson(latest, 'notification');
    }
};
