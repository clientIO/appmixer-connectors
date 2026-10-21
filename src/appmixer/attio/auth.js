'use strict';

// Attio workspace access token (Workspace settings → Developers → New access token).
// Tokens do not expire and are sent as a Bearer token. GET /v2/self identifies the token
// and returns the workspace name; a revoked or unknown token returns { active: false }.
module.exports = {
    type: 'apiKey',
    definition: {
        tokenType: 'authentication-token',

        auth: {
            apiKey: {
                type: 'password',
                name: 'Access Token',
                tooltip: 'In Attio open <b>Workspace settings → Developers</b>, click <i>+ New access token</i>, give it a name and grant the scopes the components need (read-write for records, lists, list entries, notes, tasks, comments and webhooks; read for object configuration, list configuration and user management). Only workspace admins can create tokens. See <a href="https://attio.com/help/apps/other-apps/generating-an-api-key" target="_blank">Attio help</a>.'
            }
        },

        requestProfileInfo: async (context) => {
            const { data } = await context.httpRequest({
                method: 'GET',
                url: 'https://api.attio.com/v2/self',
                headers: { Authorization: `Bearer ${context.apiKey}` }
            });
            return data;
        },

        accountNameFromProfileInfo: (context) => {
            const profile = context.profileInfo || {};
            return profile.workspace_name || profile.workspace_slug || 'Attio workspace';
        },

        validate: async (context) => {
            const { data } = await context.httpRequest({
                method: 'GET',
                url: 'https://api.attio.com/v2/self',
                headers: { Authorization: `Bearer ${context.apiKey}` }
            });
            if (!data || data.active !== true) {
                throw new Error('The Attio access token is not active. Create a new token in Workspace settings → Developers.');
            }
            return true;
        }
    }
};
