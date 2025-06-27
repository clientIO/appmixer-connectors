'use strict';

module.exports = {

    type: 'oauth2',

    definition: () => {

        let guildId;

        return {

            scope: ['bot'],

            scopeDelimiter: '+',

            authUrl: (context) => {

                return 'https://discord.com/oauth2/authorize?' +
                    `client_id=${encodeURIComponent(context.clientId)}&` +
                    `scope=${encodeURIComponent(context.scope)}&` +
                    'permissions=805315601&' +
                    `redirect_uri=${encodeURIComponent(context.callbackUrl)}&` +
                    'response_type=code&' +
                    `state=${encodeURIComponent(context.ticket)}`;
            },

            requestAccessToken: async (context) => {
                const body = {
                    'grant_type': 'authorization_code',
                    'code': context.authorizationCode,
                    'redirect_uri': context.callbackUrl,
                    'client_id': context.clientId,
                    'client_secret': context.clientSecret
                };

                const { data } = await context.httpRequest({
                    method: 'POST',
                    url: 'https://discord.com/api/oauth2/token',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    data: body
                });

                guildId = data.guild.id;

                const expDate = new Date();
                expDate.setTime(expDate.getTime() + (data.expires_in * 1000));

                return {
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    accessTokenExpDate: expDate
                };
            },

            requestProfileInfo: async (context) => {
                const { data } = await context.httpRequest({
                    method: 'GET',
                    url: 'https://discord.com/api/oauth2/applications/@me',
                    headers: {
                        Authorization: `Bot ${context.botToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                return {
                    ...data,
                    guildId
                };
            },

            accountNameFromProfileInfo: 'application.name',

            validateAccessToken: 'https://discord.com/api/oauth2/@me',

            refreshAccessToken: async (context) => {
                const body = {
                    'grant_type': 'refresh_token',
                    'refresh_token': context.refreshToken,
                    'client_id': context.clientId,
                    'client_secret': context.clientSecret
                };

                const { data } = await context.httpRequest({
                    method: 'POST',
                    url: 'https://discord.com/api/oauth2/token',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    data: body
                });

                const expDate = new Date();
                expDate.setTime(expDate.getTime() + (data.expires_in * 1000));

                return {
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    accessTokenExpDate: expDate
                };
            },
        };
    }
};
