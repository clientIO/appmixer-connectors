'use strict';

module.exports = {
    async receive(context) {
        const { url, method, body } = context.messages.in.content;

        // Construct the request options
        const requestOptions = {
            method: method,
            url: url,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        // If there's a body, add it to the request options
        if (body) {
            requestOptions.data = JSON.parse(body);
        }

        try {
            // Make the API call
            const response = await context.httpRequest(requestOptions);

            // Send the response data to the out port
            await context.sendJson({
                status: response.status,
                headers: response.headers,
                body: response.data
            }, 'out');
        } catch (error) {
            // Handle errors by sending the error status and message
            await context.sendJson({
                status: error.response?.status || 500,
                headers: error.response?.headers || {},
                body: error.response?.data || { error: error.message }
            }, 'out');
        }
    }
};
