'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            clientId: {
                type: 'text',
                name: 'Client ID',
                tooltip: 'Provide your client ID.'
            },

            clientSecret: {
                type: 'password',
                name: 'Client Secret',
                tooltip: 'Provide your client secret.'
            }
        },

        accountNameFromProfileInfo: 'clientId',

        requestProfileInfo: async context => {

            const obfuscatedClientId = context.clientId.substring(0, 3) + '...' + context.clientId.substring(context.clientId.length - 3);

            return { clientId: obfuscatedClientId };
        },

        validate: async context => {

            await context.httpRequest({
                url: 'https://api.naxai.com/ping',
                method: 'GET',
                headers: {
                    'X-Client-Id': context.clientId,
                    'X-Client-Secret': context.clientSecret
                }
            });

            return;
        }
    }
};
