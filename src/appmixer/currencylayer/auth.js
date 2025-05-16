'use strict';
module.exports = {
    type: 'apiKey',
    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your currencylayer account and find <i>API Keys</i> page.'
            },
            protocol: {
                type: 'text',
                name: 'Protocol',
                tooltip: 'If you have a paid subscription to Currencylayer, enter <i>https</i>. Otherwise enter <i>http</i>. Https protocol is not supported for free subscription accounts'
            }
        },


        accountNameFromProfileInfo: (context) => {
            const apiKey = context.apiKey;
            return apiKey.substr(0, 6) + '...' + apiKey.substr(-6);
        },

        validate: async (context) => {
            const response = await context.httpRequest({
                method: 'GET',
                url: `${context.protocol}://api.currencylayer.com/api/live?access_key=${context.apiKey}&currencies=EUR,GBP,CAD,PLN&source=USD&format=1`
            });

            if (response.data.success) {
                return response.data.success;
            } else {
                throw new Error('Authentication Failed: ' + response.data.error.info);
            }
        }
    }
};
