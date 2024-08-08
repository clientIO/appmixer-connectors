'use strict';

const BASE_URL = 'https://api.notion.com/v1';
const API_VERSION = '2022-06-28';

module.exports = {
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
                'Notion-Version': API_VERSION,
                'Content-Type': 'application/json',
                ...headers
            },
            params
        };

        if (data) {
            options.data = data;
        }

        return await context.httpRequest(options);
    }
};
