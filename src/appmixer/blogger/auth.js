'use strict';

module.exports = {
    type: 'apiKey',
    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your Blogger (Google) account and create an API key in the Google Cloud Console.'
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
            // Blogger API: Get user info
            // https://developers.google.com/blogger/docs/3.0/reference/users/get
            // const url = `https://www.googleapis.com/blogger/v3/users/self?key=${context.apiKey}`;
            // const response = await context.httpRequest({
            //     method: 'GET',
            //     url
            // });
            // if (!response.data || !response.data.id) {
            //     throw new Error('Authentication failed: Invalid API Key or insufficient permissions.');
            // }
            return true;
        }
    }
};
