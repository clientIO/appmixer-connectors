'use strict';
const lib = require('../../lib');

const fetchDatabases = async (context) => {
    const response = await lib.callEndpoint(context, '/search', {
        method: 'POST',
        data: {
            filter: {
                value: 'database',
                property: 'object'
            },
            page_size: 100
        }
    });

    return response.data.results.map(database => ({
        id: database.id,
        title: database.title[0]?.plain_text || 'Untitled',
        created_time: database.created_time,
        last_edited_time: database.last_edited_time
    }));
};

module.exports = {
    // Private: only ever called as the source of a database dropdown. Cached, and a
    // failure renders an empty dropdown rather than an error — the input is a
    // typeahead, so the ID can still be typed in.
    async receive(context) {
        try {
            const databases = await lib.withCache(context, ['ListDatabases'], () => fetchDatabases(context));
            return context.sendJson({ databases }, 'out');
        } catch (err) {
            return context.sendJson({ databases: [] }, 'out');
        }
    },

    databaseToSelectArray({ databases }) {
        return databases.map(database => {
            return { label: database.title, value: database.id };
        });
    }
};
