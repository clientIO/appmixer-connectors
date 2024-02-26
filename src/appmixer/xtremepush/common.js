const EUROPE_BASE_URL = 'https://external-api.xtremepush.com';

/**
 * Makes a HTTP request to an external API.
 *
 * @param {object} context - The context object containing configuration and authentication details.
 * @param {object} options - The options object containing details about the request.
 * @param {string} options.method - The HTTP method to use for the request (default: 'POST').
 * @param {string} options.path - The path of the API endpoint.
 * @param {object} options.data - The data to be sent in the request body.
 * @return {Promise<object>} A promise that resolves with the response from the API.
 */
const makeRequest = async ({ context, options }) => {

    const baseUrl = context.config.baseUrl || EUROPE_BASE_URL;
    const sanitizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    return context.httpRequest({
        method: options.method || 'POST',
        url: `${sanitizedBaseUrl}/api/external${options.path}`,
        json: true,
        headers: {
            'content-type': 'application/json'
        },
        data: {
            'apptoken': context.apiKey || context.auth.apiKey,
            ...options.data
        }
    });
};

module.exports = { makeRequest };
