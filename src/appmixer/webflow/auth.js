'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your Webflow account and find <i>API Keys</i> page.'
            }
        },

        validate: {
            method: 'GET',
            url: 'https://api.webflow.com/sites',
            headers: {
                accept: 'application/json',
                authorization: 'Bearer {{apiKey}}',
                'accept-version': '1.0.0',
                'Content-Type': 'application/json'
            }
        }
    }
};
