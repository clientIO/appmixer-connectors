'use strict';

module.exports = {

    type: 'oauth2',

    definition: {

        accountNameFromProfileInfo: 'resource.email',

        authUrl: 'https://auth.calendly.com/oauth/authorize',

        requestAccessToken: 'https://auth.calendly.com/oauth/token',

        requestProfileInfo: {
            method: 'GET',
            url: 'https://api.calendly.com/users/me',
            headers: {
                'Authorization': 'Bearer {{accessToken}}'
            }
        },

        refreshAccessToken: 'https://auth.calendly.com/oauth/token',

        validateAccessToken: {
            method: 'GET',
            url: 'https://api.calendly.com/users/me',
            headers: {
                'Authorization': 'Bearer {{accessToken}}'
            }
        }
    }
};
