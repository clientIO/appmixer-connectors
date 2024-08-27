'use strict';
module.exports = {

    /**
     * This function is used to get a new access token for personio as pwd auth doesn't support refreshing tokens
     * @param {Object} context
     * @return {string}
     */

    async getBearerToken(context) {
        const clientId = context.auth.clientId;
        const clientSecret = context.auth.clientSecret;
        const authorizationUrl = 'https://api.personio.de/v1/auth';

        const { data } = await context.httpRequest({
            url: authorizationUrl,
            method: "POST",
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json'
            },
            data: {
                client_id: clientId,
                client_secret: clientSecret
            },
            json: true
        });
        if (data.error) {
            throw new Error("Invalid username/password combination.");
        }

        const { token } = data.data;

        return token
    }
};