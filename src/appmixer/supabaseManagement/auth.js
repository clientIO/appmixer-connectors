'use strict';

module.exports = {
    type: 'apiKey',
    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'Personal Account Token',
                tooltip: 'To generate or manage your personal access tokens, visit your account page.'
            }
        },

        async requestProfileInfo(context) {
            const apiKey = context.apiKey;
            return {
                key: apiKey.substr(0, 3) + '...' + apiKey.substr(4)
            };
        },
        accountNameFromProfileInfo: 'key',

        async validate(context) {
            const url = 'https://api.supabase.com/v1/projects/';
            const headers = {
                'Authorization': `Bearer ${context.apiKey}`,
                'Accept': 'application/json'
            };
            // Try to list projects (should return 200 if valid)
            const response = await context.httpRequest({
                method: 'GET',
                url: url,
                headers
            });

            return response;
        }
    }
};
