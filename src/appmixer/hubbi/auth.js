'use strict';

// HubBI is deployed per tenant, so the base URL is part of the credentials rather than a
// constant. Every call carries the clientKey query param and a Bearer JWT. HubBI exposes no
// authorization-code flow for the Flows API, hence apiKey rather than OAuth2.
module.exports = {

    type: 'apiKey',

    definition: {

        tokenType: 'authentication-token',

        auth: {
            baseUrl: {
                type: 'text',
                name: 'Base URL',
                tooltip: 'Your HubBI tenant base URL, e.g. <code>https://test-app.hubbi.nl</code> (no trailing slash).'
            },
            token: {
                type: 'text',
                name: 'API Token',
                tooltip: 'Your HubBI JWT. Sent as <code>Authorization: Bearer &lt;token&gt;</code> on every request.'
            },
            clientKey: {
                type: 'text',
                name: 'Client Key',
                tooltip: 'Your HubBI client identifier (UUID). Passed as the <code>clientKey</code> query parameter on every request.'
            }
        },

        // Mask the client key to first/last three characters, e.g. "HubBI (abc...123)".
        accountNameFromProfileInfo: context => {
            const key = (context.clientKey || '').toString();
            const masked = key.length > 6 ? `${key.slice(0, 3)}...${key.slice(-3)}` : key;
            return `HubBI (${masked})`;
        },

        // There is no dedicated profile endpoint; probe ListTargetHubs to confirm the
        // credentials work and reach a real tenant.
        requestProfileInfo: async context => {
            const baseUrl = (context.baseUrl || '').replace(/\/+$/, '');
            const { data } = await context.httpRequest({
                method: 'GET',
                url: `${baseUrl}/Flows/Home/ListTargetHubs`,
                params: { clientKey: context.clientKey },
                headers: {
                    Authorization: `Bearer ${context.token}`
                }
            });
            return data;
        },

        validate: async context => {
            const baseUrl = (context.baseUrl || '').replace(/\/+$/, '');
            await context.httpRequest({
                method: 'GET',
                url: `${baseUrl}/Flows/Home/ListTargetHubs`,
                params: { clientKey: context.clientKey },
                headers: {
                    Authorization: `Bearer ${context.token}`
                }
            });
            // If the request doesn't throw, the credentials are valid.
            return true;
        }
    }
};
