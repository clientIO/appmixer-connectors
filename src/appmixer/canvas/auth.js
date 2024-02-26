'use strict';
const Canvas = require('./canvas-sdk');

module.exports = {

    type: 'apiKey',

    definition: {

        tokenType: 'authentication-token',

        auth: {
            accessToken: {
                type: 'text',
                name: 'Access Token',
                tooltip: 'Your Canvas access token. You can create an access token from your account inside Account > Settings and under Approved Integrations'
            }
        },

        accountNameFromProfileInfo: 'name',

        requestProfileInfo: async context => {

            const client = new Canvas(context.accessToken, context);
            const { data } = await client.getSelfUser();
            return data;
        },

        validate: async context => {

            const client = new Canvas(context.accessToken, context);
            const { status } = await client.getSelfUser();
            return status === 200;
        }
    }
};
