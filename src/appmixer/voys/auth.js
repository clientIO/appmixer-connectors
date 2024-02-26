'use strict';

const dependencies = {
    jsonata: require('jsonata')
};

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            "username": {
                "name": "Username",
                "type": "text",
                "tooltip": ""
            },
            "apiKey": {
                "name": "API Key",
                "type": "text",
                "tooltip": ""
            }
        },

        replaceVariables(context, str) {
            Object.keys(this.auth).forEach(variableName => {
                str = str.replaceAll('{' + variableName + '}', context[variableName]);
            });
            return str;
        },

        getBaseUrl(context) {
            let url = 'https://freedom.voys.nl/api';
            return url;
        },

        requestProfileInfo(context) {
            return {
                name: this.replaceVariables(context, '{username}')
            };
        },

        accountNameFromProfileInfo: 'name',

        async validate(context) {
            const method = 'GET';
            const url = '/callnotification/callnotification/';
            const baseUrl = this.getBaseUrl(context);
            const normalizedUrl = this.replaceVariables(context, baseUrl + url);
            const options = {
                method: method,
                url: normalizedUrl
            };
            options.headers = {
                "Authorization": "token {username}:{apiKey}"
            };
            options.headers = JSON.parse(this.replaceVariables(context, JSON.stringify(options.headers)));
            try {
                options.validateStatus = (status) => {
                    return status === 405;
                };
                await context.httpRequest(options);
                return true;
            } catch (err) {
                throw new Error(method + ' ' + normalizedUrl + ' Error: ' + err);
            }
        }
    }
};