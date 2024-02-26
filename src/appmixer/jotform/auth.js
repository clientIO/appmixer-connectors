'use strict';

const dependencies = {
    jsonata: require('jsonata')
};

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Enter your API key.'
            },
            'regionPrefix': {
                type: 'text',
                name: 'regionPrefix',
                tooltip: 'Type "eu-api" if your account is in EU Safe mode or "api" otherwise.'
            }
        },

        replaceVariables(context, str) {
            Object.keys(this.auth).forEach(variableName => {
                str = str.replaceAll('{' + variableName + '}', context[variableName]);
            });
            return str;
        },

        getBaseUrl(context) {
            let url = 'https://{regionPrefix}.jotform.com';
            url = url.replaceAll('{regionPrefix}', context.regionPrefix || 'api');
            return url;
        },

        async requestProfileInfo(context) {
            const method = 'GET';
            const url = '/user?apiKey={apiKey}';
            const baseUrl = this.getBaseUrl(context);
            const normalizedUrl = this.replaceVariables(context, baseUrl + url);
            const options = {
                method: method,
                url: normalizedUrl
            };
            const {
                data
            } = await context.httpRequest(options);
            const transformExpression = dependencies.jsonata('content.name');
            const profile = await transformExpression.evaluate(data);
            return {
                name: profile
            };
        },

        accountNameFromProfileInfo: 'name',

        async validate(context) {
            const method = 'GET';
            const url = '/user?apiKey={apiKey}';
            const baseUrl = this.getBaseUrl(context);
            const normalizedUrl = this.replaceVariables(context, baseUrl + url);
            const options = {
                method: method,
                url: normalizedUrl
            };
            await context.httpRequest(options);
            return true;
        }
    }
};
