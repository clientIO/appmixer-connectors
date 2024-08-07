'use strict';

module.exports = {
    async receive(context) {
        const apiVersion = '2022-06-28';
        const authHeader = `Bearer ${context.auth.accessToken}`;
        const url = 'https://api.notion.com/v1/search';

        const response = await context.httpRequest({
            method: 'POST',
            url: url,
            headers: {
                'Authorization': authHeader,
                'Notion-Version': apiVersion,
                'Content-Type': 'application/json'
            },
            data: {
                query: '',
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
