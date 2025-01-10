'use strict';
const { getClientForAuth } = require('./common');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            tokenType: 'authentication-token',

            accountNameFromProfileInfo: 'database',

            auth: {
                connectionUri: {
                    type: 'text',
                    name: 'Connection URI',
                    tooltip: 'Provide the connection URI',
                    required: true
                },
                database: {
                    type: 'text',
                    name: 'Database',
                    tooltip: 'Name of your database'
                },
                tlsCAFileContent: {
                    type: 'textarea',
                    name: 'TLS CA File',
                    tooltip: 'Paste text content of <code>.crt</code> file.'
                },
                tlsAllowInvalidHostnames: {
                    type: 'text',
                    name: 'TLS Allow Invalid Hostnames',
                    tooltip: 'Type <code>true</code> to allow invalid hostnames.'
                },
                tlsAllowInvalidCertificates: {
                    type: 'text',
                    name: 'TLS Allow Invalid Certificates',
                    tooltip: 'Type <code>true</code> to allow invalid certificates.'
                }
            },

            validate: async context => {

                let conn;
                try {
                    conn = await getClientForAuth(context);
                    return true;
                } finally {
                    conn && await conn.close();
                }
            }
        };
    }
};
