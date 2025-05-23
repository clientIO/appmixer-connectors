'use strict';

const hasTenant = function(context) {
    const microsoftTenant = context.config?.microsoftTenant;
    if (microsoftTenant === undefined) {
        return false;
    }
    return microsoftTenant === true || typeof microsoftTenant === 'string' && microsoftTenant.toLowerCase() === 'true' || false;
};

module.exports = {

    type: 'oauth2',

    definition: {

        scope: ['offline_access', 'user.read'],

        scopeDelimiter: ' ',

        pre: function(context) {
            if (hasTenant(context)) {
                return {
                    microsoftTentant: {
                        type: 'text',
                        name: 'Tenant',
                        tooltip: 'Specify the Tenant. Valid values are common, organizations, consumers, and tenant identifiers.'
                    }
                };
            }

            return;
        },

        authUrl: context => {
            const microsoftTenantId = hasTenant(context) ? '{{microsoftTentant}}' : 'common';

            return `https://login.microsoftonline.com/${microsoftTenantId}/oauth2/v2.0/authorize`
                + `?client_id=${encodeURIComponent(context.clientId)}`
                + '&response_type=code'
                + `&redirect_uri=${context.callbackUrl}`
                + `&state=${context.ticket}`
                + `&scope=${context.scope.join(module.exports.definition.scopeDelimiter)}`;
        },

        requestAccessToken: async (context) => {
            const microsoftTenantId = hasTenant(context) ? context.microsoftTentant : 'common';

            const { authorizationCode } = context;
            const url = `https://login.microsoftonline.com/${microsoftTenantId}/oauth2/v2.0/token`;
            const clientId = encodeURIComponent(context.clientId);
            const clientSecret = encodeURIComponent(context.clientSecret);
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

            const accessTokenExpDate = new Date();
            accessTokenExpDate.setTime(accessTokenExpDate.getTime() + (data.expires_in * 1000));

            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                accessTokenExpDate
            };
        },

        refreshAccessToken: async (context) => {
            const microsoftTenantId = hasTenant(context) ? context.microsoftTentant : 'common';

            const url = `https://login.microsoftonline.com/${microsoftTenantId}/oauth2/v2.0/token`;
            const clientId = encodeURIComponent(context.clientId);
            const clientSecret = encodeURIComponent(context.clientSecret);
            const tokenRequestData = `client_id=${clientId}`
                + `&client_secret=${clientSecret}`
                + '&grant_type=refresh_token'
                + `&refresh_token=${context.refreshToken}`;

            const options = {
                url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: tokenRequestData
            };
            const { data } = await context.httpRequest(options);

            const accessTokenExpDate = new Date();
            accessTokenExpDate.setTime(accessTokenExpDate.getTime() + (data.expires_in * 1000));

            return {
                accessToken: data.access_token,
                accessTokenExpDate,
                refreshToken: data.refresh_token
            };
        },

        accountNameFromProfileInfo: (context) => {
            const { profileInfo } = context;
            return profileInfo.displayName.trim() || profileInfo.userPrincipalName.trim() || profileInfo.id;
        },

        emailFromProfileInfo: 'mail',

        requestProfileInfo: 'https://graph.microsoft.com/v1.0/me',

        validateAccessToken: {
            method: 'GET',
            url: 'https://graph.microsoft.com/v1.0/me',
            auth: {
                bearer: '{{accessToken}}'
            }
        }
    }
};
