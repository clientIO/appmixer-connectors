'use strict';

module.exports = {

    type: 'oauth2',

    definition: context => {

        return {

            scope: context.authConfig.useRefreshToken ? ['offline', 'accounts:read'] : ['accounts:read'],

            scopeDelimiter: ' ',

            accountNameFromProfileInfo: 'alias',

            authUrl: 'https://api.typeform.com/oauth/authorize',

            requestAccessToken: 'https://api.typeform.com/oauth/token',

            refreshAccessToken: 'https://api.typeform.com/oauth/token',

            requestProfileInfo: 'https://api.typeform.com/me',

            validateAccessToken: {
                method: 'GET',
                url: 'https://api.typeform.com/me',
                auth: {
                    bearer: '{{accessToken}}'
                }
            }
        };
    }
};
