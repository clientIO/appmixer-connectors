const { makeRequest } = require('./commons');

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

        requestProfileInfo: async context => {

            const { data } = await makeRequest(context, '/accounts/account', { method: 'POST' });

            if (!data?.data) {
                throw 'Authentication Failed';
            }

            const account = data?.data[0];

            return {
                tenantId: account.tenantId,
                displayName: account.email
            };
        },

        validate: async context => {

            const { data } = await makeRequest(context, '/accounts/account', { method: 'POST' });
            return !!data?.data;
        }
    }
};
