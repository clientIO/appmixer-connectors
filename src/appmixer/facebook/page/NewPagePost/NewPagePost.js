'use strict';
const graph = require('fbgraph');
const Promise = require('bluebird');
const CursorPaging = require('../../lib').CursorPaging;

/**
 * Process posts to find newly added.
 * @param {Set} knownPosts
 * @param {Set} actualPosts
 * @param {Set} newPosts
 * @param {Object} post
 */
function processPosts(knownPosts, actualPosts, newPosts, post) {

    if (knownPosts && !knownPosts.has(post['id'])) {
        newPosts.add(post);
    }
    actualPosts.add(post['id']);
}

/**
 * Component which triggers whenever new post is added
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let since = parseInt((new Date().getTime() / 1000).toFixed(0));

        graph.setVersion('3.2');
        let client = graph.setAccessToken(context.auth.accessToken);
        let { pageId } = context.properties;
        let get = Promise.promisify(client.get, { context: client });

        let pageDetails = await get(`/${pageId}`, { fields: 'access_token, name' });

        client.setAccessToken(pageDetails['access_token']);

        let paging = new CursorPaging(get);
        let posts = await paging.fetch(`/${pageId}/feed?since=${context.state.since || since}`);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        posts.forEach(processPosts.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.map(diff, post => {
                return context.sendJson(
                    Object.assign(
                        post,
                        {
                            pageName: pageDetails['name'],
                            pageId: pageId
                        }),
                    'post');
            });
        }

        await context.saveState({ known: Array.from(actual), since });
    }
};
