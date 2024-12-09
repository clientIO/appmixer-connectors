'use strict';

module.exports = {
    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'userEmail',

        auth: {
            userEmail: {
                type: 'text',
                name: 'User Email',
                tooltip: 'Enter your own email address. This will be used for account info.'
            },
            apiKey: {
                type: 'password',
                name: 'API Key',
                tooltip: 'Log into your Verify-Email account and find <i>API Key</i> on your API integration page.'
            }
        },

        validate: {
            method: 'GET',
            url: 'https://verifyemail.io/api/email?verifyemail&email={{userEmail}}&apikey={{apiKey}}',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }
    }
};
