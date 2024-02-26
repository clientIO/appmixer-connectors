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

    /**
     * Twitter API cannot handle ! and other characters.
     * @param {string} str
     * @return {string}
     */
    escape(str) {

        return encodeURIComponent(str).replace(/[!*()']/g, function(character) {
            return '%' + character.charCodeAt(0).toString(16);
        });
    }
};
