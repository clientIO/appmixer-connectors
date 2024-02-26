'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your Clearbit account and find <i>API Keys</i> page.'
            }
        },

        validate: {
            method: 'GET',
            url: 'https://company.clearbit.com/v2/companies/find?domain=appmixer.com',
            headers: {
                'Authorization': 'Bearer {{apiKey}}'
            }
        }
    }
};
