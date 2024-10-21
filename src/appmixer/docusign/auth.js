'use strict';
const commons = require('./docusign-commons');

module.exports = {
    type: 'oauth2',

    definition: {

        scope: ['signature'],

        accountNameFromProfileInfo: context => {
            return context.profileInfo.name;
        },

        scopeDelimiter: ' ',

        authUrl: context => {
            const isProduction = context.config.production === true || context.config.production === 'true';
            const baseUrl = isProduction
                ? 'https://account.docusign.com/oauth/auth'
                : 'https://account-d.docusign.com/oauth/auth';

            return `${baseUrl}?response_type=code&client_id=${context.clientId}&scope=${context.scope}&redirect_uri=${context.callbackUrl}&state=${context.ticket}`;
        },

        requestAccessToken: async context => {
            const { clientId, clientSecret, authorizationCode } = context;
            const tokenResponse = await commons.getAccessToken(clientId, clientSecret, authorizationCode, context);
            let newDate = new Date();
            newDate.setTime(newDate.getTime() + (tokenResponse['expires_in'] * 1000));

            return {
                accessToken: tokenResponse['access_token'],
                refreshToken: tokenResponse['refresh_token'],
                accessTokenExpDate: newDate
            };
        },

        refreshAccessToken: async context => {
            const { clientId, clientSecret, refreshToken } = context;
            const tokenResponse = await commons.refreshToken(clientId, clientSecret, refreshToken, context);

            let newDate = new Date();
            newDate.setTime(newDate.getTime() + (tokenResponse['expires_in'] * 1000));

            return {
                accessToken: tokenResponse['access_token'],
                refreshToken: tokenResponse['refresh_token'],
                accessTokenExpDate: newDate
            };
        },

        requestProfileInfo: async context => {
            const isProduction = String(context.config.production).toLowerCase() === 'true';
            const { data } = await context.httpRequest({
                method: 'GET',
                url: isProduction
                    ? 'https://account.docusign.com/oauth/userinfo'
                    : 'https://account-d.docusign.com/oauth/userinfo',
                headers: {
                    Authorization: `Bearer ${context.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            return data;
        },

        validateAccessToken: async context => {
            const isProduction = String(context.config.production).toLowerCase() === 'true';
            const response = await context.httpRequest({
                method: 'GET',
                url: isProduction
                    ? 'https://account.docusign.com/oauth/userinfo'
                    : 'https://account-d.docusign.com/oauth/userinfo',
                headers: {
                    Authorization: `Bearer ${context.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        }

    }
};
