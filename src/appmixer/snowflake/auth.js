'use strict';
const { SnowflakeDB } = require('./common');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {

            tokenType: 'authentication-token',

            accountNameFromProfileInfo: 'username',

            auth: {
                account: {
                    type: 'text',
                    name: 'Account',
                    tooltip: 'Your snowflake instance URL starts with your account name. It goes like this: </br><code>https://&lt;account_name&gt;.snowflakecomputing.com</code>',
                    required: true
                },
                username: {
                    type: 'text',
                    name: 'Username',
                    tooltip: 'The login name for your Snowflake user or your Identity Provider.',
                    required: true
                },
                password: {
                    type: 'password',
                    name: 'Password',
                    tooltip: 'Password for the user.',
                    required: true
                },
                database: {
                    type: 'text',
                    name: 'Database',
                    tooltip: 'Name of your database.',
                    required: true
                },
                warehouse: {
                    type: 'text',
                    name: 'Warehouse',
                    tooltip: 'Name of your warehouse.',
                    required: true
                }
            },

            validate: async context => {
                const snowflake = new SnowflakeDB();
                const conn = await snowflake.getConnection(context);
                return conn ? true : false;
            }
        };
    }
};
