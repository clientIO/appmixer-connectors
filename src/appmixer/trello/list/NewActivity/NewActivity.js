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

        let { boardId, boardListId, boardListCardId } = context.properties;

        let { data: res } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://api.trello.com${buildUrl(boardId, boardListId, boardListCardId)}?${commons.getAuthQueryParams(context)}`
        });
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.forEach(processActivities.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.map(diff, activity => {
                return context.sendJson(activity, 'activity');
            });
        }
        await context.saveState({ known: Array.from(actual) });
    }
};

