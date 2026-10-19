'use strict';

module.exports = {
    type: 'apiKey',
    definition: {
        tokenType: 'authentication-token',

        auth: {
            host: {
                type: 'text',
                name: 'PostHog Host',
                tooltip: 'Base URL of your PostHog instance. US Cloud: https://us.posthog.com, '
                    + 'EU Cloud: https://eu.posthog.com, or your self-hosted URL.'
            },
            apiKey: {
                type: 'text',
                name: 'Personal API Key',
                tooltip: 'Generate a Personal API key in PostHog under Settings → User → Personal API Keys.'
            }
        },

        accountNameFromProfileInfo: 'email',

        requestProfileInfo: async (context) => {
            const host = (context.host || 'https://us.posthog.com').replace(/\/+$/, '');
            const { data } = await context.httpRequest({
                method: 'GET',
                url: `${host}/api/users/@me/`,
                headers: {
                    'Authorization': `Bearer ${context.apiKey}`
                }
            });
            return data;
        },

        validate: async (context) => {
            const host = (context.host || 'https://us.posthog.com').replace(/\/+$/, '');
            await context.httpRequest({
                method: 'GET',
                url: `${host}/api/users/@me/`,
                headers: {
                    'Authorization': `Bearer ${context.apiKey}`
                }
            });
            return true;
        }
    }
};
