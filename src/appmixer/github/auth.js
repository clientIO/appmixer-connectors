'use strict';
const lib = require('./lib');

module.exports = {

    type: 'oauth2',

    definition: {

        accountNameFromProfileInfo: 'login',

        authUrl: 'https://github.com/login/oauth/authorize',

        requestAccessToken: 'https://github.com/login/oauth/access_token',

        requestProfileInfo: async context => {

            const { data } = await lib.callEndpoint(context, 'user');
            return data;
        },

        validateAccessToken: async context => {

            const { data } = await lib.callEndpoint(context, 'user');
            return data;
        }
    }
};
