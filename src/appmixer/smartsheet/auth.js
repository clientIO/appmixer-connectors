'use strict';

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
                    context.log({ msg: 'Failed to replace variable ' + variableName + '.', error });
                }
            });
            return str;
        },

        validate: context => {
            return true;
        }
    }
};
