'use strict';

const { kafka } = require('./common');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {

            tokenType: 'authentication-token',

            accountNameFromProfileInfo: 'clientId',

            auth: {
                clientId: {
                    type: 'text',
                    name: 'Client ID',
                    tooltip: 'A logical identifier of an application.'
                },
                brokers: {
                    type: 'text',
                    name: 'Brokers',
                    tooltip: 'Comma separated broker addresses.'
                },
                ssl: {
                    type: 'text',
                    name: 'SSL',
                    tooltip: 'Enable/Disable SSL.'
                },
                saslMechanism: {
                    type: 'text',
                    name: 'SASL Mechanism',
                    tooltip: 'SASL mechanism type.'
                },
                saslUsername: {
                    type: 'text',
                    name: 'SASL Username',
                    tooltip: 'SASL username.'
                },
                saslPassword: {
                    type: 'password',
                    name: 'SASL Password',
                    tooltip: 'SASL password'
                }
            },

            validate: async context => {

                let kafkaMaster = kafka();
                kafkaMaster.init(context);
                return await kafkaMaster.authenticateAdmin();
            }
        };
    }
};
