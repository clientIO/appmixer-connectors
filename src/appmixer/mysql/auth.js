'use strict';
const mysql = require('mysql');

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
                    tooltip: 'Database Port'
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

                const opt = {
                    user: context.dbUser,
                    host: context.dbHost,
                    database: context.database,
                    password: context.dbPassword
                };

                if (context.dbPort) {
                    opt.port = context.dbPort;
                }

                const conn = mysql.createConnection(opt);

                return new Promise((resolve, reject) => {
                    conn.connect(err => {
                        if (err) {
                            conn.end();
                            return reject(err);
                        }
                        conn.end();
                        resolve();
                    });
                });
            }
        };
    }
};
