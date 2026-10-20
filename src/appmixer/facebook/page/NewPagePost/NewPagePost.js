'use strict';

const { getPageClient } = require('../../lib');

/**
 * Map a raw feed post into the output shape this trigger emits.
 * Shared by tick() and test() so the emitted object is byte-for-byte identical.
 */
function mapPost(post, pageDetails, pageId) {

    return {
        ...post,
        pageName: pageDetails.name,
        pageId
    };
}

/**
 * Trigger that fires whenever a new post is created on a page.
 */
module.exports = {

    async tick(context) {

        const { pageId } = context.properties;
        const since = Math.floor(Date.now() / 1000);

        const { client, pageDetails } = await getPageClient(context, pageId);

        const posts = await client.fetchAll(`/${pageId}/feed`, {
            since: context.state.since || since,
            fields: 'id,message,created_time'
        });

        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const actual = new Set();
        const diff = [];

        for (const post of posts) {
            if (known && !known.has(post.id)) {
                diff.push(post);
            }
            actual.add(post.id);
        }

        for (const post of diff) {
            await context.sendJson(mapPost(post, pageDetails, pageId), 'post');
        }

        await context.saveState({ known: Array.from(actual), since });
    },

    async test(context) {

        const { pageId } = context.properties;

        // Read-only, no state: fetch the newest post directly (the /feed endpoint returns
        // posts newest-first) WITHOUT the since/known baseline that tick() uses to suppress
        // the first poll, so Flow Test Mode gets a real, fetchable item.
        const { client, pageDetails } = await getPageClient(context, pageId);

        const { data } = await client.get(`/${pageId}/feed`, {
            fields: 'id,message,created_time',
            limit: 1
        });

        const post = (data || [])[0];
        if (!post) {
            throw new Error('No posts on the page to use as test data.');
        }

        return context.sendJson(mapPost(post, pageDetails, pageId), 'post');
    }
};
