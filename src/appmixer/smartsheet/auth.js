'use strict';

const lib = require('./lib');

module.exports = {

    type: 'oauth2',

    definition: {

        scope: ['ADMIN_SHEETS','ADMIN_SIGHTS','ADMIN_USERS','ADMIN_WEBHOOKS','ADMIN_WORKSPACES','CREATE_SHEETS','CREATE_SIGHTS','DELETE_SHEETS','DELETE_SIGHTS','READ_CONTACTS','READ_EVENTS','READ_SHEETS','READ_SIGHTS','READ_USERS','SHARE_SHEETS','SHARE_SIGHTS','WRITE_SHEETS'],

        scopeDelimiter: ' ',

        authUrl: 'https://app.smartsheet.com/b/authorize',

        requestAccessToken: 'https://api.smartsheet.com/2.0/token',

        refreshAccessToken: 'https://api.smartsheet.com/2.0/token',

        replaceVariables(context, str) {

            Object.getOwnPropertyNames(context).forEach(variableName => {
                try {
                    str = str.replaceAll('{' + variableName + '}', context[variableName]);
                } catch (error) {
                    // no-op, keep the original string
                }
            });
            return str;
        },

        accountNameFromProfileInfo: 'email',

        requestProfileInfo: async context => {

            const user = await context.httpRequest({
                url: lib.getBaseUrl(context) + '/users/me',
                method: 'GET',
                data: null,
                headers: {
                    'Authorization': 'Bearer ' + context.accessToken

                }
            });
            return user.data;
        },

        validate: async context => {

            await context.httpRequest({
                url: lib.getBaseUrl(context) + '/users/me',
                method: 'GET',
                data: null,
                headers: {
                    'Authorization': 'Bearer ' + context.accessToken

                }
            });
            return true;
        }
    }
};
