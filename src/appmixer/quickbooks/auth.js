'use strict';
const { makeRequest, requestAccessToken, getBaseUrl } = require('./commons');


module.exports = {

    type: 'oauth2',

    definition: () => {

        let companyId;

        return {

            scope: [
                'com.intuit.quickbooks.accounting',
                'openid',
                'profile',
                'email',
                'phone',
                'address'
            ],

            scopeDelimiter: ' ',

            authUrl: 'https://appcenter.intuit.com/connect/oauth2',

            requestAccessToken,

            refreshAccessToken: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',

            accountNameFromProfileInfo: context => {

                const { companyId, email } = context.profileInfo;
                const obfuscatedCompanyId = companyId.replace(/^(.{4}).*(.{4})$/, '$1...$2');

                // Format: info@acme.com (1284...1416)
                return `${email} (${obfuscatedCompanyId})`;
            },

            processRedirectionCallback: async params => {

                companyId = params.realmId || null;
            },

            requestProfileInfo: async context => {

                const options = {
                    url: `${getBaseUrl(context, true)}/v1/openid_connect/userinfo`,
                    method: 'GET',
                    data: null
                };
                const { data } = await makeRequest({ context, options });
                data.companyId = companyId;
                return data;
            },
            validateAccessToken: async context => {

                const options = {
                    url: `${getBaseUrl(context, true)}/v1/openid_connect/userinfo`,
                    method: 'GET',
                    data: null
                };
                const { data } = await makeRequest({ context, options });
                data.companyId = companyId;
                return data;
            }
        };
    }
};
