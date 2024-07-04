'use strict';

const connections = require('./connections');

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
                    tooltip: 'A logical identifier of an application. Choose a meaningful name to logically group your clients. Example: booking-events-processor.'
                },
                brokers: {
                    type: 'text',
                    name: 'Brokers',
                    tooltip: 'A comma separated list of broker addresses. Example: glider.srvs.cloudkafka.com:9094.'
                },
                ssl: {
                    type: 'text',
                    name: 'SSL',
                    tooltip: 'Enable/Disable SSL. Enter the string "TRUE" if you want to enable SSL.'
                },
                saslMechanism: {
                    type: 'text',
                    name: 'SASL Mechanism',
                    tooltip: 'SASL mechanism type. Supported values: SCRAM-SHA-256, SCRAM-SHA-512, PLAIN.'
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

                const client = connections.initClient(context, context);
                const testProducer = client.producer();
                await testProducer.connect();
                await testProducer.disconnect();
                return true;
            }
        };
    }
};
