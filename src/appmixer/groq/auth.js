'use strict';

module.exports = {
    type: 'apiKey',

    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'To generate, go to API Keys in your Groq dashboard.'
            }
        },

        replaceVariables(context, str) {
            Object.keys(this.auth).forEach(variableName => {
                str = str.replaceAll('{' + variableName + '}', context[variableName]);
            });
            return str;
        },

        requestProfileInfo(context) {
            const apiKey = this.replaceVariables(context, '{apiKey}');
            return {
                name: apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 4)
            };
        },

        accountNameFromProfileInfo: 'name',


        async validate(context) {
            return await context.httpRequest({
                url: 'https://api.groq.com/openai/v1/models',
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${context.apiKey}`
                }
            }).then(response => {
                return response.data;
            }).catch(error => {
                throw new Error('Invalid API Key: ' + error.message);
            });
        }
    }
};
