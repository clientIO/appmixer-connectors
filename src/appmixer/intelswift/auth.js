// const { makeRequest } = require('./common');

module.exports = {

    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'displayName',

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                required: true,
                tooltip: 'Enter your IntelSwift API key.'
            }
        },

        requestProfileInfo: (context) => {

            return {
                tenantId: context.apiKey,
                displayName: context.apiKey.substring(0, 15) + '...'
            };
        },

        validate: async context => {

            // await makeRequest({ context, options: { path: '/list/profile' , data: { 'limit': 1 } } });
            return true;
        }
    }
};
