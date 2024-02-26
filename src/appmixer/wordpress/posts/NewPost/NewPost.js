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
    }
};
