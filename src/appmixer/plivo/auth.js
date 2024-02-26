'use strict';
const Plivo = require('plivo');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            tokenType: 'authentication-token',

            auth: {
                accountSID: {
                    type: 'text',
                    name: 'Account SID',
                    tooltip: 'Log into your Plivo account and find <i>API Credentials</i> on your settings page.'
                },
                authenticationToken: {
                    type: 'text',
                    name: 'Authentication Token',
                    tooltip: 'Found directly next to your Account SID.'
                }
            },

            validate: context =>  new Plivo.Client(context.accountSID, context.authenticationToken).accounts.get(),

            requestProfileInfo: async context => {

                const { accountSID, authenticationToken } = context;
                const client = new Plivo.Client(accountSID, authenticationToken);

                return client.accounts.get();
            },

            accountNameFromProfileInfo: 'name'
        };
    }
};
