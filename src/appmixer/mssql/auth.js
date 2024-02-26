'use strict';
const { createConnection } = require('./common');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {

            tokenType: 'authentication-token',

            accountNameFromProfileInfo: 'database',

            auth: {
                dbHost: {
                    type: 'text',
                    name: 'Host',
                    tooltip: 'Database Host'
                },
                database: {
                    type: 'text',
                    name: 'Database',
                    tooltip: 'Name of your database'
                },
                dbUser: {
                    type: 'text',
                    name: 'User',
                    tooltip: 'Database User'
                },
                dbPassword: {
                    type: 'password',
                    name: 'Password',
                    tooltip: 'Password'
                }
            },

            validate: context => {

                return createConnection(context);

            }
        };
    }
};
