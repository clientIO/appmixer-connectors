'use strict';

const lib = require('./lib');

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Enter your API key.'
            }

        },

        replaceVariables(context, str) {
            Object.keys(this.auth).forEach(variableName => {
                str = str.replaceAll('{' + variableName + '}', context[variableName]);
            });
            return str;
        },

        async requestProfileInfo(context) {
            const method = 'GET';
            const url = '/app/sb/api/auth/me';
            const baseUrl = lib.getBaseUrl(context);
            const normalizedUrl = this.replaceVariables(context, baseUrl + url);
            const options = { method: method, url: normalizedUrl };
            options.headers = {
                'X-API-Key': '{apiKey}'
            };
            options.headers = JSON.parse(this.replaceVariables(context, JSON.stringify(options.headers)));
            const { data } = await context.httpRequest(options);
            const transformExpression = lib.jsonata('email');
            const profile = await transformExpression.evaluate(data);
            return { name: profile };
        },

        accountNameFromProfileInfo: 'name',

        async validate(context) {
            const method = 'GET';
            const url = '/app/sb/api/auth/me';
            const baseUrl = lib.getBaseUrl(context);
            const normalizedUrl = this.replaceVariables(context, baseUrl + url);
            const options = { method: method, url: normalizedUrl };
            options.headers = {
                'X-API-Key': '{apiKey}'
            };
            options.headers = JSON.parse(this.replaceVariables(context, JSON.stringify(options.headers)));
            await context.httpRequest(options);
            return true;
        }
    }
};
