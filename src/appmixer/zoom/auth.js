'use strict';

const lib = require('./lib');

module.exports = {

    type: 'oauth2',

    definition: {

        scope: [],

        scopeDelimiter: ' ',

        authUrl: 'https://zoom.us/oauth/authorize',

        requestAccessToken: 'https://zoom.us/oauth/token',

        refreshAccessToken: 'https://zoom.us/oauth/token',

        replaceVariables(context, str) {

            Object.getOwnPropertyNames(context).forEach(variableName => {
                try {
                    str = str.replaceAll('{' + variableName + '}', context[variableName]);
                } catch (error) {
                    context.log({ msg: 'Failed to replace variable ' + variableName + '.', error });
                }
            });
            return str;
        },

        async requestProfileInfo(context) {
            const method = 'GET';
            const url = '/users/me';
            const baseUrl = lib.getBaseUrl(context);
            const normalizedUrl = this.replaceVariables(context, baseUrl + url);
            const options = { method: method, url: normalizedUrl };
            options.headers = {
                'Authorization': 'Bearer {accessToken}'
            };
            options.headers = JSON.parse(this.replaceVariables(context, JSON.stringify(options.headers)));
            const { data } = await context.httpRequest(options);
            return data;
        },

        async accountNameFromProfileInfo(context) {
            const transformExpression = lib.jsonata('email');
            const name = await transformExpression.evaluate(context.profileInfo);
            return name;
        },

        async validate(context) {
            const method = 'GET';
            const url = '/users/me';
            const baseUrl = lib.getBaseUrl(context);
            const normalizedUrl = this.replaceVariables(context, baseUrl + url);
            const options = { method: method, url: normalizedUrl };
            options.headers = {
                'Authorization': 'Bearer {accessToken}'
            };
            options.headers = JSON.parse(this.replaceVariables(context, JSON.stringify(options.headers)));
            await context.httpRequest(options);
            return true;
        }
    }
};
