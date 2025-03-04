'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                apiKey: {
                    type: 'text',
                    name: 'API Key',
                    tooltip: 'Log into your Google Console account and create an API key for the Gemini API.'
                }
            },

            validate: async (context) => {

                const url = 'https://generativelanguage.googleapis.com/v1beta/models';
                return context.httpRequest.get(url + `?key=${context.apiKey}`);
            },

            accountNameFromProfileInfo: (context) => {
                const apiKey = context.apiKey;
                return apiKey.substr(0, 6) + '...' + apiKey.substr(-6);
            }
        };
    }
};
