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
                    tooltip: 'Enable/Disable SSL. Enter the string "TRUE" if you want to enable SSL. This will be overridden when `sslRejectUnauthorized` is set or a certificate is provided.'
                },
                sslRejectUnauthorized: {
                    type: 'select',
                    name: 'SSL Reject Unauthorized',
                    // Providing an example in case the customer is on Appmixer < 6.1.
                    tooltip: 'Reject unauthorized SSL certificates. `true` or `false`.',
                    placeholder: 'Select an option',
                    options: [
                        { label: 'true', value: 'true' },
                        { label: 'false', value: 'false' }
                    ]
                },
                tlsCA: {
                    type: 'textarea',
                    name: 'TLS CA File',
                    tooltip: 'Paste text content of <code>ca.pem</code> file.'
                },
                tlsKey: {
                    type: 'textarea',
                    name: 'TLS Key',
                    tooltip: 'Paste text content of <code>service.key</code> file.'
                },
                tlsCert: {
                    type: 'textarea',
                    name: 'TLS Cert',
                    tooltip: 'Paste text content of <code>service.cert</code> file.'
                },
                saslMechanism: {
                    type: 'text',
                    name: 'SASL Mechanism',
                    tooltip: 'SASL mechanism type. Supported values: SCRAM-SHA-256, SCRAM-SHA-512, PLAIN. If provided, the saslUsername and saslPassword fields are required and all the SSL certificates are ignored.'
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

                const client = await connections.initClient(context, context);
                const testProducer = client.producer();
                await testProducer.connect();
                await testProducer.disconnect();
                return true;
            }
        };
    }
};
