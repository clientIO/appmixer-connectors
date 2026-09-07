'use strict';

const lib = require('./lib');

// Woodpecker uses API-key authentication only (no OAuth2). The key is created in the
// Woodpecker panel under Add-ons -> API & Integrations -> API keys and is sent in the
// `x-api-key` header on every request. Credentials are validated against GET /v1/me.
module.exports = {
    type: 'apiKey',
    definition: {
        tokenType: 'authentication-token',

        auth: {
            apiKey: {
                type: 'password',
                name: 'API Key',
                tooltip: 'Log into your Woodpecker panel and go to <b>Add-ons → API & Integrations → API keys</b>, then create a key. The "API keys & integrations" add-on is required (included during trial, paid add-on on regular plans).'
            }
        },

        accountNameFromProfileInfo: 'email',

        requestProfileInfo: async (context) => {

            const { data } = await context.httpRequest({
                method: 'GET',
                url: `${lib.API_BASE_URL}/v1/me`,
                headers: {
                    'x-api-key': context.apiKey
                }
            });

            // Normalize the response so the connector always has a stable account name and
            // a company identifier used by the webhook triggers to scope incoming events.
            const email = data.email || data.login || data.user || data.company || 'Woodpecker account';
            const companyId = data.company_id || data.companyId || data.id || email;

            return { ...data, email, companyId };
        },

        validate: async (context) => {

            await context.httpRequest({
                method: 'GET',
                url: `${lib.API_BASE_URL}/v1/me`,
                headers: {
                    'x-api-key': context.apiKey
                }
            });

            return true;
        }
    }
};
