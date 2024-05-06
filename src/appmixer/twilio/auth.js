'use strict';

const twilio = require('twilio');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {

            tokenType: 'authentication-token',

            accountNameFromProfileInfo: 'accountSID',

            auth: {
                accountSID: {
                    type: 'text',
                    name: 'Account SID',
                    tooltip: 'Log into your Twilio account and find <i>API Credentials</i> on your settings page.'
                },
                authenticationToken: {
                    type: 'text',
                    name: 'Authentication Token',
                    tooltip: 'Found directly next to your Account SID.'
                }
            },

            validate: context => {

                let client = new twilio(context.accountSID, context.authenticationToken);
                return client.api.accounts.list();
            }
        };
    }
};
