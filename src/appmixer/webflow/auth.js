'use strict';

module.exports = {
    type: 'apiKey',

    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your Webflow account and find <i>API Keys</i> page.'
            }
        },

        async requestProfileInfo(context) {
            const url = 'https://api.webflow.com/v2/token/authorized_by';
            const headers = {
                'accept': 'application/json',
                'authorization': `Bearer ${context.apiKey}`,
                'accept-version': '2.0.0',
                'Content-Type': 'application/json'
            };

            const response = await context.httpRequest({ url, method: 'GET', headers });

            if (response.data && response.data.firstName && response.data.lastName) {
                const fullName = `${response.data.firstName} ${response.data.lastName}`;
                return { name: fullName };
            } else if (response.data && response.data.email) {
                return { name: response.data.email };
            }
        },

        accountNameFromProfileInfo: 'name',

        validate: {
            method: 'GET',
            url: 'https://api.webflow.com/v2/sites',
            headers: {
                accept: 'application/json',
                authorization: 'Bearer {{apiKey}}',
                'accept-version': '2.0.0',
                'Content-Type': 'application/json'
            }
        }
    }
};
