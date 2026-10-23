'use strict';

const { freshsalesBaseUrl } = require('./lib');

module.exports = {
    type: 'apiKey',
    definition: {
        auth: {
            domain: {
                type: 'text',
                name: 'Bundle Alias',
                tooltip: 'Your Freshsales bundle alias. Copy your bundle alias from your Profile settings page. For example: appmixer-944514646623155365.myfreshworks.com/crm/sales'
            },
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your Freshsales account and find your <i>API Key</i> in Profile settings.'
            }
        },

        requestProfileInfo(context) {
            const apiKey = context.apiKey;
            return {
                key: apiKey.substr(0, 13) + '...' + apiKey.substr(apiKey.length - 9)
            };
        },

        accountNameFromProfileInfo: 'key',

        validate: async function(context) {
            // appmixer-944514646623155365.myfreshworks.com/crm/sales
            const url = `${freshsalesBaseUrl(context.domain)}/api/selector/owners`;
            const headers = {
                'Authorization': `Token token=${context.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            const response = await context.httpRequest({
                method: 'GET',
                url,
                headers
            });

            if (response.status !== 200 || !response.data) {
                throw new Error('Invalid Freshsales credentials. Please check your Bundle Alias and API Key.');
            }
            return true;
        }
    }
};
