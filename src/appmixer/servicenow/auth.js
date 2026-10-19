'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'account',

        auth: {
            username: {
                type: 'text',
                name: 'Username (Auth Option 1)',
                tooltip: 'For example: admin'
            },
            password: {
                type: 'text',
                name: 'Password (Auth Option 1)',
                tooltip: 'On instances that restrict Basic auth, the user needs the snc_basic_auth_api_access role.'
            },
            apiKey: {
                type: 'text',
                name: 'API Key (Auth Option 2)',
                tooltip: 'If API Key is entered, the username and password is ignored'
            },
            instance: {
                type: 'text',
                name: 'Instance name (Required)',
                tooltip: 'For example: dev144860'
            },
            webhookSecret: {
                type: 'password',
                name: 'Webhook Secret (Required for triggers)',
                tooltip: 'A random string of at least 16 characters. Your ServiceNow business rule must send it in the X-Appmixer-Secret header of every event; events without the matching secret are ignored.'
            }
        },

        requestProfileInfo: async function(context) {

            const headers = {
                'User-Agent': 'Appmixer (info@appmixer.com)'
            };

            if (context.apiKey) {
                headers['x-sn-apikey'] = context.apiKey;
            } else {
                headers['Authorization'] = 'Basic ' + Buffer.from(context.username + ':' + context.password).toString('base64');
            }

            const options = {
                method: 'GET',
                url: 'https://' + context.instance + '.service-now.com/api/now/table/problem?sysparm_limit=1',
                headers
            };

            try {
                // Simply make a request to the API to see if the credentials are valid.
                await context.httpRequest(options);
                // If the request was successful, return the profile info.
                if (context.apiKey) {
                    // Use sliced API key when API key is provided
                    const maskedApiKey = context.apiKey.slice(0, 8) + '...';
                    return { account: context.instance + '-' + maskedApiKey };
                } else {
                    // Use username when username/password authentication is used
                    return { account: context.instance + '-' + context.username };
                }
            } catch (error) {
                return error;
            }
        },

        validate: async function(context) {

            const headers = {};

            if (context.apiKey) {
                headers['x-sn-apikey'] = context.apiKey;
            } else {
                headers['Authorization'] = 'Basic ' + Buffer.from(context.username + ':' + context.password).toString('base64');
            }

            const options = {
                method: 'GET',
                url: 'https://' + context.instance + '.service-now.com/api/now/table/problem?sysparm_limit=1',
                headers
            };
            try {
                await context.httpRequest(options);
            } catch (err) {
                // Instances that restrict Basic auth reject a correct password with 401 unless the user
                // has the snc_basic_auth_api_access role.
                if (!context.apiKey && err.response?.status === 401) {
                    throw new Error('ServiceNow rejected the username and password (401). Check them, and make sure the user has '
                        + 'the snc_basic_auth_api_access role: instances that restrict Basic auth require it for API access.');
                }
                throw err;
            }

            return true;
        }
    }
};
