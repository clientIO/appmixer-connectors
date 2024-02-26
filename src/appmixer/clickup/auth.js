'use strict';


module.exports = {

    type: 'oauth2',

    definition: () => {

        return {

            scope: [],

            authUrl: 'https://app.clickup.com/api',

            requestAccessToken: 'https://api.clickup.com/api/v2/oauth/token',

            requestProfileInfo: 'https://api.clickup.com/api/v2/user',

            accountNameFromProfileInfo: 'user.username',

            validateAccessToken: 'https://api.clickup.com/api/v2/user'
        };
    }
};
