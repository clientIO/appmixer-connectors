'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            key: {
                type: 'text',
                name: 'API key',
                tooltip: 'Log into your Verify-Email account and find <i>API key</i> on your API integration page.'
            }
        },

        validate: {
            method: 'GET',
            url: 'https://app.verify-email.org/api/v1/{{key}}/credits',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }
    }
};
