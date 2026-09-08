'use strict';

/**
 * OAuth 2.1 + PKCE authentication for HubSpot MCP server.
 *
 * HubSpot MCP Auth Apps use a separate OAuth flow from the standard HubSpot OAuth.
 * The MCP Auth App is created in HubSpot's Development > MCP Auth Apps section.
 * Scopes are determined dynamically during installation based on available MCP tools
 * and user permissions — they are NOT explicitly defined in this auth config.
 *
 * @see https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server
 */
module.exports = {

    type: 'oauth2',

    definition: {

        accountNameFromProfileInfo: 'name',

        // MCP scopes are determined at installation time by the MCP server.
        // We request no explicit scopes — the user grants permissions during the OAuth flow.
        scope: [],
        scopeDelimiter: ' ',

        authUrl: 'https://app.hubspot.com/oauth/authorize',

        requestAccessToken: 'https://api.hubapi.com/oauth/v1/token',

        requestProfileInfo: {
            method: 'GET',
            url: 'https://api.hubapi.com/oauth/v1/access-tokens/{{accessToken}}',
            headers: {
                'Authorization': 'Bearer {{accessToken}}',
                'User-Agent': 'Appmixer'
            }
        },

        refreshAccessToken: 'https://api.hubapi.com/oauth/v1/token',

        validateAccessToken: {
            method: 'GET',
            url: 'https://api.hubapi.com/oauth/v1/access-tokens/{{accessToken}}',
            headers: {
                'Authorization': 'Bearer {{accessToken}}',
                'User-Agent': 'Appmixer'
            }
        }
    }
};
