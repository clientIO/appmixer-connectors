'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

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
module.exports = {

    async tick(context) {

        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let newNotification = Promise.promisify(client.get, { context: client });

        let res = await newNotification(
            '/1/members/me/notifications'
        );
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.forEach(processNotifications.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.map(diff, notification => {
                return context.sendJson(notification, 'notification');
            });
        }
        await context.saveState({ known: Array.from(actual) });
    }
};

