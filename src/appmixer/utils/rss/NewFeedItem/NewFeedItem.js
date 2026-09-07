'use strict';

const Parser = require('rss-parser');

// Shared by tick() and test(): fetch and parse the configured feed URL.
async function fetchFeed(context) {

    const { url } = context.properties;
    const parser = new Parser();
    return parser.parseURL(url);
}

module.exports = {

    async tick(context) {

        const feed = await fetchFeed(context);

        let seen = await context.stateGet('seen');
        seen = seen ? new Set(seen) : null;
        const current = new Set();
        const diff = [];

        if (Array.isArray(feed.items)) {
            feed.items.forEach(item => {
                const key = item.guid + ':' + item.title + ':' + item.link;
                current.add(key);
                if (seen && !seen.has(key)) {
                    diff.push(item);
                }
            });
        }

        await context.stateSet('seen', Array.from(current));

        if (diff.length > 0) {
            return context.sendArray(diff, 'out');
        }
    },

    async test(context) {

        // Polling-with-source: reuse the same feed-parsing path tick() uses and emit the
        // newest feed item (RSS feeds are ordered newest-first), shaped identically to
        // what tick() emits. No state read/write.
        const feed = await fetchFeed(context);
        const items = Array.isArray(feed.items) ? feed.items : [];

        if (!items.length) {
            throw new Error('The feed has no items to use as test data.');
        }

        return context.sendJson(items[0], 'out');
    }
};
