'use strict';

const API_VERSION = '2022-06-28';

const BASE_URL = 'https://api.notion.com/v1';

module.exports = {
    API_VERSION,
    async callEndpoint(context, endpoint, {
        method = 'GET',
        params = {},
        data = null,
        headers = {}
    } = {}) {
        const options = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Notion-Version': API_VERSION, //api version from config.js,
                'Content-Type': 'application/json',
                ...headers
            },
            params
        };

        if (data) {
            options.data = data;
        }

        return await context.httpRequest(options);
    },

    // Shared request+shape path for database-item triggers. Queries a database
    // sorted by `timestamp` in the given `direction` and returns the raw items
    // (the triggers emit the unmodified Notion item object).
    async queryDatabaseItems(context, databaseId, { timestamp, direction = 'descending', pageSize } = {}) {
        const data = {
            sorts: [
                {
                    'timestamp': timestamp,
                    'direction': direction
                }
            ]
        };
        if (pageSize) {
            data.page_size = pageSize;
        }
        const response = await this.callEndpoint(context, `/databases/${databaseId}/query`, {
            method: 'POST',
            data
        });
        return response.data.results || [];
    }
};
