'use strict';

const ENVIRONMENT_PATTERN = /^(au|eu|na|staging)$/;

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            'environment': {
                'type': 'select',
                'name': 'Environment',
                'options': [{
                    'content': 'Australia',
                    'value': 'au'
                },
                {
                    'content': 'Europe',
                    'value': 'eu'
                },
                {
                    'content': 'North America',
                    'value': 'na'
                },
                {
                    'content': 'Staging',
                    'value': 'staging'
                }
                ]
            },
            'clientId': {
                'type': 'text',
                'name': 'Client ID',
                'tooltip': 'Client Id is used to authentication all requests using the ClientId HTTP header.'
            },
            'companyId': {
                'type': 'text',
                'name': 'Company ID'
            },
            'publicKey': {
                'type': 'text',
                'name': 'Public Key'
            },
            'privateKey': {
                'type': 'text',
                'name': 'Private Key'
            }
        },

        accountNameFromProfileInfo: 'companyId',

        validate: async function(context) {
            // The environment becomes part of the request host, and the keys are sent to that host.
            // The select offers these values only, but the field can be set through the API as well.
            if (!ENVIRONMENT_PATTERN.test(context.environment)) {
                throw new Error('Invalid ConnectWise environment. Choose Australia, Europe, North America or Staging.');
            }
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
