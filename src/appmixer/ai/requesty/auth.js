'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                apiKey: {
                    type: 'text',
                    name: 'API Key',
                    tooltip: 'Sign in at <a href="https://app.requesty.ai" target="_blank">app.requesty.ai</a>, go to <i>API Keys</i> and click <i>Create New Key</i>. Copy the key and paste it here.'
                }
            },

            validate: async (context) => {
                await context.httpRequest({
                    method: 'GET',
                    url: 'https://router.requesty.ai/v1/models',
                    headers: {
                        accept: 'application/json',
                        Authorization: `Bearer ${context.apiKey}`
                    }
                });
                return true;
            },

            accountNameFromProfileInfo: (context) => {
                const apiKey = context.apiKey;
                return apiKey.substr(0, 6) + '...' + apiKey.substr(-4);
            }
        };
    }
};
