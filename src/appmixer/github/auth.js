'use strict';
const commons = require('./github-commons');

module.exports = {

    type: 'oauth2',

    definition: {

        accountNameFromProfileInfo: 'login',

        authUrl: 'https://github.com/login/oauth/authorize',

        requestAccessToken: 'https://github.com/login/oauth/access_token',

        requestProfileInfo: async context => {

            let github = commons.getGithubAPI(context.accessToken);
            const { data } = await github.users.getAuthenticated();
            return data;
        },

        validateAccessToken: async context => {

            let github = commons.getGithubAPI(context.accessToken);
            const { data } = await github.users.getAuthenticated();
            return data;
        }
    }
};
