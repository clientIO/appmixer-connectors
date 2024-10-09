'use strict';

module.exports = {

    async requestAccessToken(context) {

        const { clientId, clientSecret, authorizationCode } = context;
        const authorizationHeader = Buffer.from(
            `${clientId}:${clientSecret}`,
            'utf8'
        ).toString('base64');
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            Authorization: `Basic ${authorizationHeader}`
        };
        const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
        const requestBody = `grant_type=authorization_code&code=${authorizationCode}&redirect_uri=${context.callbackUrl}&code_verifier=${context.ticket}`;
        const { data: tokenResponse } = await context.httpRequest({
            url: tokenUrl,
            method: 'POST',
            data: requestBody,
            headers: headers
        });
        const expirationTime = new Date();
        expirationTime.setTime(
            expirationTime.getTime() + tokenResponse['expires_in'] * 1000
        );
        return {
            accessToken: tokenResponse['access_token'],
            refreshToken: tokenResponse['refresh_token'],
            accessTokenExpDate: expirationTime
        };
    },

    refreshAccessToken: async context => {

        const { clientId, clientSecret, refreshToken } = context;

        const authorizationHeader = Buffer.from(
            `${clientId}:${clientSecret}`,
            'utf8'
        ).toString('base64');

        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.twitter.com/2/oauth2/token',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${authorizationHeader}`
            },
            data: {
                grant_type: 'refresh_token',
                client_id: clientId,
                refresh_token: refreshToken
            }
        });

        const newDate = new Date();
        newDate.setTime(newDate.getTime() + (data.expires_in * 1000));

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            accessTokenExpDate: newDate
        };
    },

    /**
     * Twitter API cannot handle ! and other characters.
     * @param {string} str
     * @return {string}
     */
    escape(str) {

        return encodeURIComponent(str).replace(/[!*()']/g, function(character) {
            return '%' + character.charCodeAt(0).toString(16);
        });
    },

    async request(context, { method = 'GET', action, params, data, headers = {} }) {

        const BASE_URL = 'https://api.twitter.com/2/';

        const url = `${BASE_URL}${action}`;
        return context.httpRequest({
            method,
            url,
            headers: {
                ...headers,
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            data
        });

    }

};
