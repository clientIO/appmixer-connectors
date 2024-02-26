'use strict';
const FtpClient = require('./client');
const lib = require('./lib');

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            host: {
                type: 'text',
                name: 'Host',
                tooltip: 'Host, default "localhost".'
            },
            port: {
                type: 'text',
                name: 'Port',
                tooltip: 'Default 21.'
            },
            username: {
                type: 'text',
                name: 'Username',
                tooltip: 'Username.'
            },
            password: {
                type: 'password',
                name: 'Password',
                tooltip: 'Password.'
            },
            secure: {
                type: 'text',
                name: 'Secure',
                // eslint-disable-next-line max-len
                tooltip: 'Default: "no". Use "yes" to set explicit FTPS over TLS. Use "implicit" if you need support for legacy implicit FTPS. Use "sftp" to set explicit SFTP over TLS.'
            }
        },

        accountNameFromProfileInfo: context => {

            return context.host || 'localhost';
        },

        validate: async context => {

            const config = {
                host: context.host,
                user: context.username,
                password: context.password,
                secure: lib.getAccessSecureType(context.secure)
            };
            if (context.port) {
                config.port = context.port;
            }
            const client = await FtpClient.getClientAndConnect(context.secure, config);
            await client.close();
            return true;
        }
    }
};
