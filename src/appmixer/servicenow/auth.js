'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'account',

        auth: {
            username: {
                type: 'text',
                name: 'Username',
                tooltip: 'For example: admin'
            },
            password: {
                type: 'text',
                name: 'Password'
            },
            instance: {
                type: 'text',
                name: 'Instance name',
                tooltip: 'For example: dev144860'
            }
        },

        requestProfileInfo: async function(context) {

            const basicAuth = Buffer.from(context.username + ':' + context.password).toString('base64');
            const options = {
                method: 'GET',
                url: 'https://' + context.instance + '.service-now.com/api/now/table/problem?sysparm_limit=1',
                headers: {
                    'User-Agent': 'Appmixer (info@appmixer.com)',
                    'Authorization': ('Basic ' + basicAuth)
                }
            };

            try {
                // Simply make a request to the API to see if the credentials are valid.
                await context.httpRequest(options);
                // If the request was successful, return the profile info.
                return { account: context.instance + '-' + context.username };
            } catch (error) {
                return error;
            }
        },

        validate: async function(context) {

            const basicAuth = Buffer.from(context.username + ':' + context.password).toString('base64');
            const options = {
                method: 'GET',
                url: 'https://' + context.instance + '.service-now.com/api/now/table/problem?sysparm_limit=1',
                headers: {
                    'Authorization': ('Basic ' + basicAuth)
                }
            };
            await context.httpRequest(options);

            return true;
        }
    }
};
