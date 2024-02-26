'use strict';

const Parser = require('rss-parser');

module.exports = {

    async tick(context) {

        const { url } = context.properties;
        const parser = new Parser();
        const feed = await parser.parseURL(url);

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
    }
};
