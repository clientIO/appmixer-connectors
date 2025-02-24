'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                apiKey: {
                    type: 'text',
                    name: 'API Key',
                    tooltip: 'Log into your OpenAI account and find <i>API Keys</i> page in the Settings.'
                }
            },

            validate: async (context) => {

                const url = 'https://api.openai.com/v1/models';
                return context.httpRequest.get(url, {
                    headers: {
                        'Authorization': `Bearer ${context.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
            },

            accountNameFromProfileInfo: (context) => {
                const apiKey = context.apiKey;
                return apiKey.substr(0, 6) + '...' + apiKey.substr(-6);
            }
        };
    }
};
