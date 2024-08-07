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


        requestProfileInfo(context) {
            const apiKey = context.apiKey;
            return {
                name: apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 4)
            };
        },
        accountNameFromProfileInfo: 'name',

        async validate(context) {
            const method = 'GET';
            const url = `${context.protocol}://api.currencylayer.com/api/live?access_key=${context.apiKey}&currencies=EUR,GBP,CAD,PLN&source=USD&format=1`;
            const options = { method: method, url: url };
            if (!context.apiKey) throw 'The apiKey is not valid';
            const response = await context.httpRequest(options);
            if (!response.data.success) throw JSON.stringify(response.data.error);
            return response.data.success;
        }
    }
};
