'use strict';

module.exports = {

    type: 'oauth2',

    definition: {

        accountNameFromProfileInfo: 'email',

        authUrl: 'https://public-api.wordpress.com/oauth2/authorize',

        requestProfileInfo: {
            method: 'GET',
            url: 'https://public-api.wordpress.com/rest/v1.1/me',
            headers: {
                authorization: 'Bearer {{accessToken}}'
            }
        },

        requestAccessToken: 'https://public-api.wordpress.com/oauth2/token'
    }
};
