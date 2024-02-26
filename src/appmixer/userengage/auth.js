'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API key',
                tooltip: 'Log into your userengage account and find <i>API Keys</i> page in settings.'
            }
        },

        validate: {
            method: 'GET',
            url: 'https://app.userengage.io/api/public/users/0/',
            headers: {
                authorization: 'Token {{apiKey}}'
            },
            rejectUnauthorized: false
        }
    }
};
