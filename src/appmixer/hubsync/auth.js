'use strict';

module.exports = {
    type: 'apiKey',

    definition: {
        tokenType: 'authentication-token',

        auth: {
            baseUrl: {
                type: 'string',
                name: 'Base URL',
                tooltip: 'The base URL for the API requests.'
            },
            tenant: {
                type: 'string',
                name: 'Tenant ID',
                tooltip: 'The ID of the tenant to authenticate against. The X-Tenant header value.'
            },
            apiKey: {
                type: 'password',
                name: 'API Key',
                tooltip: 'The API key for authenticating requests. The X-Api-Key header value.'
            }
        },

        accountNameFromProfileInfo: 'tenant',

        validate: async context => {
            const { baseUrl, tenant, apiKey } = context;

            if (!baseUrl || !tenant || !apiKey) {
                throw new Error('Base URL, Tenant ID, and API Key are required for authentication.');
            }

            const url = `${baseUrl}/api/common/users/me`;
            const headers = {
                'X-Api-Key': apiKey,
                'X-Tenant': tenant,
                'Content-Type': 'application/json'
            };


            await context.httpRequest({
                method: 'GET',
                url,
                headers
            });
            return true; // Authentication successful

        }
    }
};
