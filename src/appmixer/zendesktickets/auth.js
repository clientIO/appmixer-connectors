'use strict';

const lib = require('./lib');

module.exports = {

    type: 'oauth2',

    definition: {

        scope: ['users:read'],

        scopeDelimiter: ' ',

        authUrl: (context) => {

            let url = 'https://{subdomain}.zendesk.com/oauth/authorizations/new?client_id={clientId}&response_type=code&redirect_uri={callbackUrl}&state={state}&scope={scope}';
            url = url.replaceAll('{domain}', context.auth?.domain || context.config?.domain || 'zendesk');
            url = url.replaceAll('{subdomain}', context.auth?.subdomain || context.config?.subdomain || 'example');

            url = url.replaceAll('{clientId}', context.clientId);
            url = url.replaceAll('{callbackUrl}', context.callbackUrl);
            url = url.replaceAll('{state}', context.ticket);
            url = url.replaceAll('{scope}', context.scope.join(module.exports.definition.scopeDelimiter));

            return url;
        },

        requestAccessToken: async (context) => {
            const { clientId, clientSecret, authorizationCode } = context;

            let url = 'https://{subdomain}.zendesk.com/oauth/tokens';
            url = url.replaceAll('{domain}', context.auth?.domain || context.config?.domain || 'zendesk');
            url = url.replaceAll('{subdomain}', context.auth?.subdomain || context.config?.subdomain || 'example');

            const tokenRequestData = `client_id=${encodeURIComponent(clientId)}`
            + `&client_secret=${encodeURIComponent(clientSecret)}`
            + `&code=${encodeURIComponent(authorizationCode)}`
            + '&grant_type=authorization_code'
            + `&redirect_uri=${encodeURIComponent(context.callbackUrl)}`;

            const options = {
                url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: tokenRequestData
            };
            const { data } = await context.httpRequest(options);

            return { accessToken: data.access_token };
        },

        refreshAccessToken: null,

        replaceVariables(context, str) {

            Object.getOwnPropertyNames(context).forEach(variableName => {
                try {
                    str = str.replaceAll('{' + variableName + '}', context[variableName]);
                } catch (error) {
                    // no-op, keep the original string
                }
            });
            return str;
        },

        async requestProfileInfo(context) {
            const method = 'GET';
            const url = '/api/v2/users/me';
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
            const transformExpression = lib.jsonata('user.email');
            const name = await transformExpression.evaluate(context.profileInfo);
            return name;
        },

        async validate(context) {
            const method = 'GET';
            const url = '/api/v2/users/me';
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
