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
            const info = `${data.user.login} - ${data.user.api_key.slice(0, 3)}***`;
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
            const { data, status, statusText } = await context.httpRequest(options);

            if (status !== 200) {
                throw `Failed to connect to Redmine API: ${statusText}. Status code: ${status}`;
            }

            if (!data.user || !data.user.login || !data.user.api_key) {
                throw 'Invalid response from Redmine API: ' + JSON.stringify(data);
            }
            return true;
        }
    }
};
