'use strict';

const hasGlobalKeys = function(context) {
    const globalKeys = context.config?.globalKeys;
    if (globalKeys === undefined) {
        return true;
    }
    return globalKeys === true || typeof globalKeys === 'string' && globalKeys.toLowerCase() === 'true' || false;
};

module.exports = {

    type: 'oauth2',

    definition: {

        scope: ['users:read'],

        scopeDelimiter: ' ',

        pre: function(context) {

            const fields = {
                subdomain: {
                    type: 'text',
                    name: 'Subdomain',
                    tooltip: 'Your Zendesk subdomain - e.g. if the domain is <i>https://example.zendesk.com</i> just type <b>example</b> inside this field',
                    required: true
                }
            };
            if (!hasGlobalKeys(context)) {

                fields.zendeskId = {
                    type: 'text',
                    name: 'Client ID',
                    tooltip: 'Enter your Zendesk client ID',
                    required: true
                };

                fields.zendeskSecret = {
                    type: 'text',
                    name: 'Client Secret',
                    tooltip: 'Enter your Zendesk client secret',
                    required: true
                };
            }
            return { ...fields };
        },

        authUrl: (context) => {

            const clientId = hasGlobalKeys(context) ? encodeURIComponent(context.clientId) : '{{zendeskId}}';
            return 'https://{{subdomain}}.zendesk.com/oauth/authorizations/new'
                + `?client_id=${clientId}`
                + '&response_type=code'
                + `&redirect_uri=${context.callbackUrl}`
                + `&state=${context.ticket}`
                + `&scope=${context.scope.join(module.exports.definition.scopeDelimiter)}`;
        },

        requestAccessToken: async (context) => {

            const { authorizationCode } = context;
            const url = `https://${context.subdomain}.zendesk.com/oauth/tokens`;
            const isGlobal = hasGlobalKeys(context);
            const clientId = encodeURIComponent(isGlobal ? context.clientId : context.zendeskId);
            const clientSecret = encodeURIComponent(isGlobal ? context.clientSecret : context.zendeskSecret);
            const tokenRequestData = `client_id=${clientId}`
                + `&client_secret=${clientSecret}`
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

        async requestProfileInfo(context) {

            const method = 'GET';
            const url = '/api/v2/users/me';
            const baseUrl = `https://${context.subdomain}.zendesk.com`;
            const options = {
                method: method,
                url: baseUrl + url,
                headers: {
                    'Authorization': `Bearer ${context.accessToken}`
                }
            };
            const { data } = await context.httpRequest(options);
            return data;
        },

        async accountNameFromProfileInfo(context) {

            const name = context.profileInfo?.user?.email;
            return name;
        },

        async validate(context) {

            const method = 'GET';
            const url = '/api/v2/users/me';
            const baseUrl = `https://${context.subdomain}.zendesk.com`;
            const options = {
                method: method,
                url: baseUrl + url,
                headers: {
                    'Authorization': `Bearer ${context.accessToken}`
                }
            };
            await context.httpRequest(options);
            return true;
        }
    }
};
