'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'email',

        auth: {
            email: {
                type: 'text',
                name: 'Email address',
                tooltip: 'Email address associated with your account.'
            },
            slug: {
                type: 'text',
                name: 'Account name',
                tooltip: 'Find your account name in the <q>Já</q> section. Example: applecorp'
            },
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Find your API key in the <q>Já</q> section.'
            }
        },

        requestProfileInfo: {
            method: 'GET',
            url: 'https://app.fakturoid.cz/api/v2/accounts/{{slug}}/account.json',
            auth: {
                user: '{{email}}',
                pass: '{{apiKey}}'
            },
            headers: {
                'User-Agent': 'Appmixer (info@appmixer.com)'
            }
        },

        validate: {
            method: 'GET',
            url: 'https://app.fakturoid.cz/api/v2/accounts/{{slug}}/account.json',
            auth: {
                user: '{{email}}',
                pass: '{{apiKey}}'
            },
            headers: {
                'User-Agent': 'Appmixer (info@appmixer.com)'
            }
        }
    }
};
