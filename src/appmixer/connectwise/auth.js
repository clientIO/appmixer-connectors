'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            "environment": {
                "type": "select",
                "name": "Environment",
                "options": [{
                        "content": "Australia",
                        "value": "au"
                    },
                    {
                        "content": "Europe",
                        "value": "eu"
                    },
                    {
                        "content": "North America",
                        "value": "na"
                    },
                    {
                        "content": "Staging",
                        "value": "staging"
                    }
                ]
            },
            "clientId": {
                "type": "text",
                "name": "Client ID",
                "tooltip": "Client Id is used to authentication all requests using the ClientId HTTP header."
            },
            "companyId": {
                "type": "text",
                "name": "Company ID"
            },
            "publicKey": {
                "type": "text",
                "name": "Public Key"
            },
            "privateKey": {
                "type": "text",
                "name": "Private Key"
            }
        },

        accountNameFromProfileInfo: 'companyId',

        validate: function(context) {
            const url = (context.environment === 'staging') ?
                'https://api-staging.connectwisedev.com/v4_6_release/apis/3.0/system/info' :
                `https://api-${context.environment}.myconnectwise.net/v4_6_release/apis/3.0/system/info`;
            const headers = {};
            headers.Authorization =
                `Basic ${btoa(context.companyId + '+' + context.publicKey + ':' + context.privateKey)}`;
            headers.ClientId = context.clientId;
            return context.httpRequest.get(url, {
                headers
            });
        }
    }
};