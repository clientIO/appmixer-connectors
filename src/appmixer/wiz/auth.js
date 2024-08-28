'use strict';

module.exports = {

    type: 'pwd',

    definition: {

        auth: {
            clientId: {
                type: 'text',
                name: 'Client ID'
            },
            clientSecret: {
                type: 'text',
                name: 'Client Secret'
            }
        },

        accountNameFromProfileInfo: context => {

            return `${context.clientId.substring(0, 10)} ...`;
        },

        validate: async context => {

            const url = 'https://auth.app.wiz.io/oauth/token';

            const { data } = await context.httpRequest({
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    'accept': 'application/json'
                },
                data: {
                    grant_type: 'client_credentials',
                    audience: 'wiz-api',
                    client_id: context.clientId,
                    client_secret: context.clientSecret
                },
                url
            });

            return {
                token: data.access_token,
                expires: data.expires_in
            };
        }
    }
};
