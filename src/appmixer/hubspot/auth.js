'use strict';

module.exports = {

    type: 'oauth2',

    definition: {

        accountNameFromProfileInfo: 'user',

        scope: [
            'oauth',
            'tickets',
            'e-commerce',
            'timeline',
            'media_bridge.read',
            'crm.lists.read',
            'crm.lists.write',
            'crm.objects.companies.write',
            'crm.objects.companies.read',
            'crm.objects.contacts.read',
            'crm.objects.contacts.write',
            'crm.objects.deals.read',
            'crm.objects.deals.write',
            'crm.objects.owners.read',
            'crm.schemas.companies.read',
            'crm.schemas.companies.write',
            'crm.schemas.contacts.read',
            'crm.schemas.contacts.write',
            'crm.schemas.custom.read',
            'crm.schemas.deals.read',
            'crm.schemas.deals.write',
            'sales-email-read'
        ],
        scopeDelimiter: ' ',

        authUrl: 'https://app.hubspot.com/oauth/authorize',

        requestAccessToken: 'https://api.hubapi.com/oauth/v1/token',

        requestProfileInfo: {
            method: 'GET',
            url: 'https://api.hubapi.com/oauth/v1/access-tokens/{{accessToken}}',
            headers: {
                'Authorization': 'Bearer {{accessToken}}',
                'User-Agent': 'AppMixer'
            }
        },

        refreshAccessToken: 'https://api.hubapi.com/oauth/v1/token',

        validateAccessToken: {
            method: 'GET',
            url: 'https://api.hubapi.com/integrations/v1/me',
            headers: {
                'Authorization': 'Bearer {{accessToken}}',
                'User-Agent': 'AppMixer'
            }
        }
    }
};
