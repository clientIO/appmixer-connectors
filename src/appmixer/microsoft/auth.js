'use strict';

module.exports = {

    type: 'oauth2',

    definition: {

        scope: ['offline_access', 'user.read'],

        scopeDelimiter: ' ',

        pre: {
            tenant: {
                type: 'text',
                name: 'Tenant',
                tooltip: 'Specify the Tenant. Valid values are common, organizations, consumers, and tenant identifiers.'
            }
        },

        authUrl: context => {
            const microsoftTenantId = context.tenant ||
                context.config.tenant ||
                process.env.TENANT ||
                'common';

            return `https://login.microsoftonline.com/${microsoftTenantId}/oauth2/v2.0/authorize`;
        },

        requestAccessToken: context => {
            const microsoftTenantId = context.tenant ||
                context.config.tenant ||
                process.env.TENANT ||
                'common';

            return `https://login.microsoftonline.com/${microsoftTenantId}/oauth2/v2.0/token`;
        },

        refreshAccessToken: context => {
            const microsoftTenantId = context.tenant ||
                context.config.tenant ||
                process.env.TENANT ||
                'common';

            return `https://login.microsoftonline.com/${microsoftTenantId}/oauth2/v2.0/token`;
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
