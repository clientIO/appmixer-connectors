'use strict';
const commons = require('../gmail-commons');

module.exports = {
    async receive(context) {
        const endpoint = '/users/me/threads';
        const { data } = await commons.fetchData(context, endpoint);

        // Extract thread details
        const threads = data.threads.map(item => ({
            id: item.id,
            snippet: item.snippet
        }));

        return context.sendJson(threads, 'out');
    },

    threadsToSelectArray(threads) {
        return Array.isArray(threads) ? threads.reduce((result, thread) => {
            const snippet = thread.snippet ? thread.snippet.substring(0, 50) : 'NO Subject';
            result.push({
                label: snippet,
                value: thread.id
            });
            return result;
        }, []) : [];
    }
};
