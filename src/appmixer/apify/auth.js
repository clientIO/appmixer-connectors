'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        tokenType: 'authentication-token',

        auth: {
            apiUserId: {
                type: 'text',
                name: 'User ID',
                tooltip: 'Log into your Apify account and find <i>User ID</i> in Settings > Integrations page.'
            },
            apiToken: {
                type: 'text',
                name: 'API Token',
                tooltip: 'Found directly next to your User ID.'
            }
        },

        accountNameFromProfileInfo: 'data.email',

        requestProfileInfo: {
            'method': 'GET',
            'uri': 'https://api.apify.com/v2/users/{{apiUserId}}?token={{apiToken}}'
        },

        validate: {
            'method': 'GET',
            'uri': 'https://api.apify.com/v2/users/{{apiUserId}}?token={{apiToken}}'
        }
    }
};
