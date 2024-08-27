'use strict';
const lib = require('../../lib');

module.exports = {
    async receive(context) {
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

        const databases = response.data.results.map(database => ({
            id: database.id,
            title: database.title[0]?.plain_text || 'Untitled',
            created_time: database.created_time,
            last_edited_time: database.last_edited_time
        }));

        await context.sendJson({ databases }, 'out');
    },

    databaseToSelectArray({ databases }) {
        return databases.map(database => {
            return { label: database.title, value: database.id };
        });
    }
};
