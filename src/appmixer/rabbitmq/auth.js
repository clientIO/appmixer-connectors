'use strict';

const amqp = require('amqplib');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {

            tokenType: 'authentication-token',

            accountNameFromProfileInfo: 'clientId',

            auth: {
                protocol: {
                    type: 'text',
                    name: 'Protocol',
                    tooltip: 'Enter the protocol: amqp or amqps. Defaults to amqp.'
                },
                hostname: {
                    type: 'text',
                    name: 'Hostname',
                    tooltip: 'Enter hostname. Example: whale.rmq.cloudamqp.com.'
                },
                port: {
                    type: 'text',
                    name: 'Port',
                    tooltip: 'Enter port number. Defaults to 5672.'
                },
                username: {
                    type: 'text',
                    name: 'Username',
                    tooltip: 'Enter username.'
                },
                password: {
                    type: 'password',
                    name: 'Password',
                    tooltip: 'Enter password.'
                },
                vhost: {
                    type: 'text',
                    name: 'Vhost',
                    tooltip: 'Enter vhost. Defaults to /.'
                },
                locale: {
                    type: 'text',
                    name: 'Locale',
                    tooltip: 'Enter locale. Defaults to en_US.'
                }
            },

            validate: async context => {

                const connection = await amqp.connect(context);
                const channel = await connection.createChannel();
                await channel.close();
                await connection.close();
                return true;
            }
        };
    }
};
