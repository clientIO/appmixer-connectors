'use strict';

module.exports = {
    type: 'apiKey',
    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your ElevenLabs account and find your API key in the Profile > API Keys section.'
            }
        },

        async requestProfileInfo(context) {
            const apiKey = context.apiKey;
            return {
                key: apiKey.substring(0, 8) + '*****' + apiKey.substring(apiKey.length - 8)
            };
        },
        accountNameFromProfileInfo: 'key',

        validate: async (context) => {
            // ElevenLabs API: https://api.elevenlabs.io/v1/user
            const response = await context.httpRequest({
                method: 'GET',
                url: 'https://api.elevenlabs.io/v1/user',
                headers: {
                    'xi-api-key': context.apiKey
                }
            });
            if (response?.user_id) {
                throw new Error('Authentication failed: Invalid API Key or unexpected response.');
            }
            return true;
        }
    }
};
