'use strict';

const BASE_URL = 'https://gmail.googleapis.com/gmail/v1';

module.exports = {
    async fetchData(context, endpoint, options = {}) {
        const defaultHeaders = {
            Authorization: `Bearer ${context.auth.accessToken}`
        };

        const headers = { ...defaultHeaders, ...options.headers };

        const params = {
            method: options.method,
            url: `${BASE_URL}${endpoint}`,
            headers: headers,
            params: options.params || {}
        };

        const response = await context.httpRequest(params);
        return response;
    }
};
