'use strict';
const request = require('request-promise');

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API key',
                tooltip: 'Log into your Actimo account and find ' +
                    '<i>Your personal API token</i>.'
            }
        },

        requestProfileInfo: async context => ({ apiUrl: 'http://actimo.com/api/v1/' }),

        validate: async context => {

            // curl http://actimo.com/api/v1/project \
            //  -H 'api-key: abcd1234-abcd-1234-5678-abcd1234efgh'
            await request({
                method: 'GET',
                url: 'http://actimo.com/api/v1/project',
                headers: {
                    'api-key': context.apiKey
                }
            });
            // if the request doesn't fail, return true (exception will be captured in caller)
            return true;
        }
    }
};
