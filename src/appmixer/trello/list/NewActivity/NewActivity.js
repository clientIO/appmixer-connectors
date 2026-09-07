'use strict';
const commons = require('../../trello-commons');

/**
 * Process activities to find newly added.
 * @param {Set} knownActivity
 * @param {Set} actualActivity
 * @param {Set} newActivity
 * @param {Object} activity
 */
function processActivities(knownActivity, actualActivity, newActivity, activity) {

    if (knownActivity && !knownActivity.has(activity['id'])) {
        newActivity.add(activity);
    }
    actualActivity.add(activity['id']);
}

/**
 * Build url.
 * @param {string} boardId
 * @param {string} boardListId
 * @param {string} boardListCardId
 * @return {string} urlString
 */
function buildUrl(boardId, boardListId, boardListCardId) {

    let urlString = '';

    if (!boardId && !boardListId && !boardListCardId) {
        urlString = 'members/me';
    }
    if (boardId && !boardListId && !boardListCardId) {
        urlString = 'boards/' + boardId;
    }
    if (boardId && boardListId && !boardListCardId) {
        urlString = 'lists/' + boardListId;
    }
    if (boardId && boardListId && boardListCardId) {
        urlString = 'cards/' + boardListCardId;
    }

    return '/1/' + urlString + '/actions';
}

/**
 * Component which triggers whenever new activity is in Trello
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const { boardId, boardListId, boardListCardId } = context.properties;

        const res = await commons.fetchAll(context, buildUrl(boardId, boardListId, boardListCardId));
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.forEach(processActivities.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.all(Array.from(diff).map(activity => {
                return context.sendJson(activity, 'activity');
            }));
        }
        await context.saveState({ known: Array.from(actual) });
    },

    async test(context) {

        const { boardId, boardListId, boardListCardId } = context.properties;

        // Same actions listing as tick(), honoring the same board/list/card scope.
        const res = await commons.fetchAll(context, buildUrl(boardId, boardListId, boardListCardId));
        const latest = commons.pickLatestById(res);
        if (!latest) {
            throw new Error('No recent activity to use as test data.');
        }
        return context.sendJson(latest, 'activity');
    }
};

