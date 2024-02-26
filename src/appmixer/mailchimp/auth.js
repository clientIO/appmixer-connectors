'use strict';

module.exports = {

    type: 'oauth2',

    definition: {

        accountNameFromProfileInfo: 'accountname',

        emailFromProfileInfo: 'login.email',

        authUrl: 'https://login.mailchimp.com/oauth2/authorize',

        requestAccessToken: 'https://login.mailchimp.com/oauth2/token',

        requestProfileInfo: {
            'method': 'GET',
            'uri': 'https://login.mailchimp.com/oauth2/metadata',
            'headers': {
                'User-Agent': 'oauth2-draft-v10',
                'Authorization': 'OAuth {{accessToken}}'
            }
        },

        validateAccessToken: context => {

            return context.httpRequest({
                method: 'GET',
                url: 'https://login.mailchimp.com/oauth2/metadata',
                headers: {
                    'User-Agent': 'oauth2-draft-v10',
                    'Authorization': `OAuth ${context.accessToken}`
                }
            }).then(result => {
                if (result.error && result.error === 'invalid_token') {
                    throw new context.InvalidTokenError(result.error);
                }
            });
        }
    }
};
