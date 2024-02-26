/* eslint-disable camelcase */
'use strict';

module.exports = {

    type: 'oauth2',

    name: 'appmixer:microsoft:dynamics',

    // Differs from microsoft/auth.js by using `resource` and getting profile info.
    definition: {

        scope: ['offline_access'],

        scopeDelimiter: ' ',

        pre: {
            resource: {
                type: 'text',
                name: 'Resource',
                tooltip: 'Specify the Dataverse environment name to connect with. For example, https://org422b05be.crm4.dynamics.com',
                required: true
            }
        },

        authUrl: (context) => {

            return 'https://login.microsoftonline.com/common/oauth2/authorize?resource={{resource}}'
            + `&client_id=${context.clientId}`
            + '&response_type=code'
            + `&redirect_uri=${context.callbackUrl}`
            + '&response_mode=query'
            + `&state=${context.ticket}`
            + `&scope=${context.scope.join('%20')}`;
        },

        requestAccessToken: async context => {

            const { clientId, clientSecret, authorizationCode } = context;
            const { data } = await context.httpRequest({
                // Not using v2.0 endpoint because it doesn't support resource parameter and returns error when passes scope.
                url: 'https://login.microsoftonline.com/common/oauth2/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: `client_id=${encodeURIComponent(clientId)}`
                    + `&client_secret=${encodeURIComponent(clientSecret)}`
                    + `&code=${encodeURIComponent(authorizationCode)}`
                    + '&grant_type=authorization_code'
                    + `&redirect_uri=${encodeURIComponent(context.callbackUrl)}`
            });

            const { access_token, refresh_token, resource, expires_in } = data;

            let accessTokenExpDate = new Date();
            accessTokenExpDate.setTime(accessTokenExpDate.getTime() + (expires_in * 1000));

            return {
                accessToken: access_token,
                refreshToken: refresh_token,
                resource,
                accessTokenExpDate
            };
        },

        refreshAccessToken: 'https://login.microsoftonline.com/common/oauth2/token',

        accountNameFromProfileInfo: (context) => {

            const { profileInfo } = context;
            const name = profileInfo.fullname || profileInfo.internalemailaddress || profileInfo.systemuserid;

            // We want to show both the resource and the user's name or email address.
            return context.resource + ' - ' + name;
        },

        emailFromProfileInfo: 'internalemailaddress',

        requestProfileInfo: async (context) => {

            // WhoAmI
            const options = {
                url: `${context.resource}/api/data/v9.1/WhoAmI`,
                headers: {
                    Authorization: `Bearer ${context.accessToken}`
                }
            };
            const { data } = await context.httpRequest(options);
            const userId = data.UserId;

            // Request to CRM API - Retrieve User
            const { data: systemUser } = await context.httpRequest({
                url: `${context.resource}/api/data/v9.1/systemusers(${userId})?$select=fullname,internalemailaddress`,
                headers: {
                    Authorization: `Bearer ${context.accessToken}`
                }
            });

            return systemUser;
        },

        validateAccessToken: async (context) => {

            // WhoAmI
            await context.httpRequest({
                url: `${context.resource}/api/data/v9.1/WhoAmI`,
                headers: {
                    Authorization: `Bearer ${context.accessToken}`
                }
            });
        }
    }
};
