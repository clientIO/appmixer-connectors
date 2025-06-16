'use strict';

module.exports = {
    type: 'apiKey',

    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'To generate, go to Settings > API Keys in your Tally dashboard.'
            }
        },

        async requestProfileInfo(context) {
            const apiKey = context.apiKey;

            const response = await context.httpRequest({
                url: 'https://api.tally.so/users/me',
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${apiKey}`
                }
            });

            const data = response.data;

            if (data && data.fullName) {
                return { name: data.fullName };
            } else if (data && data.email) {
                return { name: data.email };
            }

            return { name: 'Unknown Tally User' };
        },

        accountNameFromProfileInfo: 'name',

        async validate(context) {
            const apiKey = context.apiKey;

            const response = await context.httpRequest({
                method: 'GET',
                url: 'https://api.tally.so/users/me',
                headers: {
                    Authorization: `Bearer ${apiKey}`
                }
            });

            return response.data;
        }
    }
};
