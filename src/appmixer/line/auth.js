'use strict';

module.exports = {
    type: 'apiKey',
    definition: {
        auth: {
            channelAccessToken: {
                type: 'password',
                name: 'Channel Access Token',
                tooltip: 'Log into your LINE Developers Console and find the Channel Access Token for your channel.'
            }
        },

        async requestProfileInfo(context) {
            // Use the LINE profile endpoint to verify the token and get user info
            // We use a dummy userId (U4af4980629...) as per LINE docs for token validation
            // But for real profile, userId is required. For validation, we can call /v2/bot/info
            const url = 'https://api.line.me/v2/bot/info';
            const headers = {
                'Authorization': `Bearer ${context.channelAccessToken}`
            };
            const { data } = await context.httpRequest({ url, method: 'GET', headers });
            if (data && data.userId) {
                return data;
            } else {
                throw new Error('Could not retrieve LINE bot info.');
            }
        },

        accountNameFromProfileInfo: 'displayName',

        validate: async (context) => {
            const url = 'https://api.line.me/v2/bot/info';
            const headers = {
                'Authorization': `Bearer ${context.channelAccessToken}`
            };
            const response = await context.httpRequest({ url, method: 'GET', headers });
            if (!response.data || !response.data.userId) {
                throw new Error('Authentication failed: Invalid Channel Access Token.');
            }
            return true;
        }
    }
};
