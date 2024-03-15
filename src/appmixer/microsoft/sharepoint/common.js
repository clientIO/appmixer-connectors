'use strict';
const oneDriveAPI = require('onedrive-api');
const commons = require('../microsoft-commons');
const { URL } = require('url');

async function makeRequest(options, context) {
    // Destructure the options and context objects
    const { url, method, body } = options;
    const { accessToken, profileInfo } = context.auth;

    // Parse the URL and default it to Microsoft Graph API if invalid
    let apiUrl;
    try {
        apiUrl = new URL(url);
    } catch (error) {
        apiUrl = new URL(url, 'https://graph.microsoft.com/v1.0/');
    }

    const endpointUrl = apiUrl.href.replace(apiUrl.origin + '/v1.0/', '');
    const apiOptions = {
        accessToken,
        url: endpointUrl,
        method,
        body: body ? JSON.parse(body) : undefined
    };
    // Call the SharePoint API endpoint and handle errors
    const apiResponse = await commons.formatError(async () => {
        return oneDriveAPI.items.customEndpoint(apiOptions);
    }, `Failed to perform the API request in your SharePoint account (${profileInfo.userPrincipalName}).`);
    return apiResponse;
}

module.exports = { makeRequest };
