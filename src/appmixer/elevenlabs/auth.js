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
                key: apiKey.substr(0, 3) + '...' + apiKey.substr(4)
            };
        },
        accountNameFromProfileInfo: 'key',

        validate: async (context) => {
            // ElevenLabs API: https://api.elevenlabs.io/v1/user
            const response = await context.httpRequest({
                method: 'GET',
                url: 'https://api.elevenlabs.io/v1/models',
                headers: {
                    'xi-api-key': context.apiKey
                }
            });
            if (!Array.isArray(response?.data)) {
                throw new Error('Authentication failed: Invalid API Key or unexpected response.');
            }
            return true;
        }
    }
};
