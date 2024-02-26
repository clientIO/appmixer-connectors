'use strict';

module.exports = {

    type: 'apiKey',

    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your currencylayer account and find <i>API Keys</i> page.'
            }
        },
        validate: {
            method: 'GET',
            url: 'https://api.apilayer.com/currency_data/live?source=USD&currencies=EUR',
            headers: {
                'apikey': '{{apiKey}}'
            }
        }
    }
};
