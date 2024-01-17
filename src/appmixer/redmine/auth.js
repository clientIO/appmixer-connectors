'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Enter your API key.'
            },
            'url': { type: 'text', name: 'url', tooltip: 'Redmine URL' }
        },

        replaceVariables(context, str) {
            Object.keys(this.auth).forEach(variableName => {
                str = str.replaceAll('{' + variableName + '}', context[variableName]);
            });
            return str;
        },

        async requestProfileInfo(context) {
            const method = 'GET';
            const url = '/my/account.json';
            const baseUrl = context.url;
            const options = { method: method, url: baseUrl + url };
            options.headers = {
                'X-Redmine-API-Key': '{apiKey}'
            };
            options.headers = JSON.parse(this.replaceVariables(context, JSON.stringify(options.headers)));
            const { data } = await context.httpRequest(options);
            // Return string in format: admin - abc***
            const info = `${data.user.login} - ${data.user.api_key.slice(0, 3)}***`
            return { info };
        },

        accountNameFromProfileInfo: 'info',

        async validate(context) {
            const method = 'GET';
            const url = '/my/account.json';
            const baseUrl = context.url;
            const options = { method: method, url: baseUrl + url };
            options.headers = {
                'X-Redmine-API-Key': '{apiKey}'
            };
            options.headers = JSON.parse(this.replaceVariables(context, JSON.stringify(options.headers)));
            await context.httpRequest(options);
            return true;
        }
    }
};
