'use strict';
const notionCommons = require('../../notion-commons');

module.exports = {
    async receive(context) {
        const response = await notionCommons.callEndpoint(context, '/search', {
            method: 'POST',
            data: {
                filter: {
                    value: 'database',
                    property: 'object'
                }
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
