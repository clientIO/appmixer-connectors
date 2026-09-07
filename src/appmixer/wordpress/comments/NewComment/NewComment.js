'use strict';
const commons = require('../../wordpress-commons');
const Promise = require('bluebird');

/**
 * Process comments to find newly added.
 * @param {Set} knownComments
 * @param {Array} currentComments
 * @param {Array} newComments
 * @param {Object} comment
 */
function processComments(knownComments, currentComments, newComments, comment) {

    //short_URL is unique value for all comments in wordpress
    if (knownComments && !knownComments.has(comment['short_URL'])) {
        newComments.push(comment);
    }

    currentComments.push(comment['short_URL']);
}

/**
 * Component which triggers whenever new comment is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { siteId, postId } = context.properties;

        let response = await commons.getBlogComments(
            {
                siteId,
                postId
            });

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        response.forEach(processComments.bind(null, known, current, diff));

        await Promise.map(diff, comment => {
            return context.sendJson(comment, 'comment');
        });
        await context.saveState({ known: current });
    },

    async test(context) {

        let { siteId, postId } = context.properties;

        // Reuse the same fetch+shape path as tick() (honoring the optional postId
        // filter via the same getBlogComments branch); the WordPress comments endpoint
        // returns newest-first, so the first item is the most recent comment. No state
        // baseline is applied here, so unlike tick()'s first run this emits an item.
        let response = await commons.getBlogComments(
            {
                siteId,
                postId
            });

        if (!response.length) {
            throw new Error('No comments on the site to use as test data.');
        }

        return context.sendJson(response[0], 'comment');
    }
};
