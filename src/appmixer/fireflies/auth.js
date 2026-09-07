/* eslint-disable max-len */
'use strict';

// Fireflies.ai exposes a single GraphQL endpoint and authenticates with a
// personal API key sent as a Bearer token. There is no usable multitenant
// OAuth2 flow (see the connector PR / issue for the research), so API key is
// the only supported authentication method.
const API_URL = 'https://api.fireflies.ai/graphql';

module.exports = {

    type: 'apiKey',

    definition: {

        tokenType: 'authentication-token',

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Generate your API key in the Fireflies app under <b>Settings &rarr; Developer Settings &rarr; Fireflies API</b> (<a href="https://app.fireflies.ai/integrations/custom/fireflies" target="_blank">app.fireflies.ai/integrations/custom/fireflies</a>).'
            }
        },

        accountNameFromProfileInfo: 'name',

        requestProfileInfo: async context => {

            const { data } = await context.httpRequest({
                method: 'POST',
                url: API_URL,
                headers: {
                    'Authorization': `Bearer ${context.apiKey}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    query: 'query { user { user_id name email } }'
                }
            });

            if (!data || !data.data || !data.data.user) {
                throw new Error('Failed to retrieve Fireflies profile info.');
            }

            return data.data.user;
        },

        validate: async context => {

            const { data } = await context.httpRequest({
                method: 'POST',
                url: API_URL,
                headers: {
                    'Authorization': `Bearer ${context.apiKey}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    query: 'query { user { user_id } }'
                }
            });

            // GraphQL may return an empty `errors` array on success, so only a
            // non-empty one means the key was rejected.
            const errors = Array.isArray(data && data.errors) ? data.errors : [];

            if (!data || errors.length || !data.data || !data.data.user) {
                throw new Error('Invalid Fireflies API key.');
            }

            return true;
        }
    }
};
