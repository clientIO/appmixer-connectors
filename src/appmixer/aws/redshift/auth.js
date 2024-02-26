'use strict';

const { Client } = require('pg');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {

            tokenType: 'authentication-token',

            accountNameFromProfileInfo: 'database',

            auth: {
                dbUser: {
                    type: 'text',
                    name: 'User',
                    tooltip: 'Database User'
                },
                dbHost: {
                    type: 'text',
                    name: 'Host',
                    tooltip: 'Database Host'
                },
                dbPort: {
                    type: 'text',
                    name: 'Port',
                    tooltip: 'Database Port(default: 5439)'
                },
                database: {
                    type: 'text',
                    name: 'Database',
                    tooltip: 'Name of your database'
                },
                dbPassword: {
                    type: 'password',
                    name: 'Password',
                    tooltip: 'Password'
                }
            },

            validate: context => {

                const client = new Client({
                    user: context.dbUser,
                    host: context.dbHost,
                    database: context.database,
                    password: context.dbPassword,
                    port: context.dbPort || 5439
                });

                return client.connect().finally(() => client.end());
            }
        };
    }
};
