'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {
        const { method, endpointPath, body } = context.messages.in.content;

        if (!method) {
            throw new Error('HTTP method is required');
        }

        if (!endpointPath) {
            throw new Error('Endpoint path is required');
        }

        // Validate HTTP method
        const allowedMethods = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
        const upperMethod = method.toUpperCase();
        if (!allowedMethods.includes(upperMethod)) {
            throw new Error(`Invalid HTTP method: ${method}. Allowed methods are: ${allowedMethods.join(', ')}`);
        }

        // Ensure endpoint path starts with a slash
        const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;

        // Remove 'v1' prefix if user included it
        const finalPath = cleanPath.startsWith('/v1/') ? cleanPath : `/v1${cleanPath}`;

        // Build request configuration
        const requestConfig = {
            method: upperMethod,
            url: `https://forms.googleapis.com${finalPath}`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        };

        // Add body for POST, PATCH, PUT methods
        if (['POST', 'PATCH', 'PUT'].includes(upperMethod) && body) {
            requestConfig.headers['Content-Type'] = 'application/json';

            // Parse body if it's a string
            if (typeof body === 'string') {
                try {
                    requestConfig.data = JSON.parse(body);
                } catch (e) {
                    throw new Error('Invalid JSON in request body');
                }
            } else {
                requestConfig.data = body;
            }
        }

        try {
            // https://developers.google.com/forms/api/reference/rest
            const { data } = await context.httpRequest(requestConfig);

            return context.sendJson({
                success: true,
                data: data
            }, 'out');
        } catch (error) {
            // Provide detailed error information
            const errorDetails = {
                success: false,
                error: {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    message: error.response?.data?.error?.message || error.message,
                    details: error.response?.data?.error?.details,
                    code: error.response?.data?.error?.code
                }
            };

            if (error.response?.status === 401) {
                throw new Error('Authentication failed. Please check your API credentials.');
            } else if (error.response?.status === 403) {
                throw new Error('Permission denied. Make sure you have the necessary scopes enabled.');
            } else if (error.response?.status === 404) {
                throw new Error(`Endpoint not found: ${requestConfig.url}`);
            } else {
                throw new Error(`API call failed: ${errorDetails.error.message}`);
            }
        }
    }
};
