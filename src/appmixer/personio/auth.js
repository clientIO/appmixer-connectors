'use strict';
module.exports = {

    type: 'pwd',

    definition: {
        accountNameFromProfileInfo: 'clientId',
        auth: {
            clientId: {
                type: 'text',
                name: 'Client Id',
                tooltip: 'Client Id'
            },
            clientSecret: {
                type: 'password',
                name: 'Client Secret',
                tooltip: 'Client Secret'
            }
        },

        validate: async context => {

            const { clientId, clientSecret } = context;
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

          const { token, expires_in } = data.data;

            return {
                token: token,
                expires: expires_in,
                clientId: clientId,
                clientSecret: clientSecret

            };
        }
    }
};