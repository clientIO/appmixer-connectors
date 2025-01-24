'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                apiKey: {
                    type: 'text',
                    name: 'API Key',
                    tooltip: 'Log into your Perplexity account and go to <i>Settings</i>. Navigate to <i>API</i> tab and find your api key.'
                }
            },

            validate: async (context) => {
                try {
                    await context.httpRequest({
                        method: 'POST',
                        url: 'https://api.perplexity.ai/chat/completions',
                        headers: {
                            accept: 'application/json',
                            'content-type': 'application/json',
                            Authorization: `Bearer ${context.apiKey}`
                        },
                        data: {
                            model: 'sonar',
                            messages: [
                                {
                                    role: 'user',
                                    content: 'Hi'
                                }
                            ],
                            max_tokens: 1
                        }
                    });
                    return true;
                } catch (error) {
                    return false;
                }
            },

            accountNameFromProfileInfo: (context) => {
                const apiKey = context.apiKey;
                return apiKey.substr(0, 6) + '...' + apiKey.substr(-6);
            }
        };
    }
};