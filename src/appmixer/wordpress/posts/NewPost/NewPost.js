'use strict';
const commons = require('../../wordpress-commons');
const Promise = require('bluebird');

/**
 * Process posts to find newly added.
 * @param {Set} knownPosts
 * @param {Array} currentPosts
 * @param {Array} newPosts
 * @param {Object} post
 */
function processPosts(knownPosts, currentPosts, newPosts, post) {

    if (knownPosts && !knownPosts.has(post['global_ID'])) {
        newPosts.push(post);
    }

    currentPosts.push(post['global_ID']);
}

/**
 * Component which triggers whenever new post is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { siteId } = context.properties;

        let res = await commons.getBlogPosts({ siteId });
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        res.forEach(processPosts.bind(null, known, current, diff));

        await Promise.map(diff, post => {
            return context.sendJson(post, 'post');
        });
        await context.saveState({ known: current });
    },

    async test(context) {

        let { siteId } = context.properties;

        // Reuse the same fetch+shape path as tick(); the WordPress posts endpoint
        // returns newest-first, so the first item is the most recent post. No state
        // baseline is applied here, so unlike tick()'s first run this emits an item.
        let res = await commons.getBlogPosts({ siteId });

        if (!res.length) {
            throw new Error('No posts on the site to use as test data.');
        }

        return context.sendJson(res[0], 'post');
    }
};
