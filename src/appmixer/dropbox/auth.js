'use strict';

module.exports = {
    type: 'oauth2',

    definition: {

        accountNameFromProfileInfo: 'email',

        authUrl: context => `https://www.dropbox.com/oauth2/authorize?response_type=code&client_id=${context.clientId}&redirect_uri=${context.callbackUrl}&state=${context.ticket}&token_access_type=offline`,

        requestAccessToken: 'https://api.dropbox.com/oauth2/token',

        refreshAccessToken: async context => {

            let refreshToken;
            try {
                refreshToken = context.refreshToken;
            }
            catch (err) {
                throw new context.InvalidTokenError('Invalid token');
            }

            const { data } = await context.httpRequest({
                method: 'POST',
                url: 'https://api.dropbox.com/oauth2/token',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: {
                    grant_type: 'refresh_token',
                    refresh_token: context.refreshToken,
                    client_id: context.clientId,
                    client_secret: context.clientSecret
                }
            });
            const newDate = new Date();
            newDate.setTime(newDate.getTime() + (data.expires_in * 1000));

            return {
                accessToken: data.access_token,
                accessTokenExpDate: newDate
            };
        },

        requestProfileInfo: async context => {

            const { data } = await context.httpRequest({
                method: 'POST',
                url: 'https://api.dropboxapi.com/2/users/get_current_account',
                headers: {
                    Authorization: `Bearer ${context.accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: null
            });
            return data;
        },

        validateAccessToken: context => {

            return context.httpRequest({
                method: 'POST',
                url: 'https://api.dropboxapi.com/2/users/get_current_account',
                headers: {
                    Authorization: `Bearer ${context.accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: null
            });
        }
    }
};
