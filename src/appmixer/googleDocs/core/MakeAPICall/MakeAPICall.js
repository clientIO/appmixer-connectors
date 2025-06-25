'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { url, method, headers = {}, data } = context.messages.in.content;

        // Prepare the request configuration
        const requestConfig = {
            method: method.toUpperCase(),
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json',
                ...headers
            }
        };

        // Determine the full URL
        let fullUrl = url;
        if (!url.startsWith('http')) {
            // If it's a relative URL, prepend the Google Docs API base URL
            fullUrl = `https://docs.googleapis.com/v1/${url.replace(/^\//, '')}`;
        }

        requestConfig.url = fullUrl;

        // Add data for POST, PUT, PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && data) {
            requestConfig.data = data;
        }

        // Make the API call
        const response = await context.httpRequest(requestConfig);

        return context.sendJson({
            data: response.data,
            status: response.status,
            headers: response.headers
        }, 'out');
    }
};
