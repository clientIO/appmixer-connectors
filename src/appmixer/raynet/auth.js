'use strict';
const request = require('request-promise');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {

            tokenType: 'basic-authentication',

            accountNameFromProfileInfo: 'login',

            auth: {
                login: {
                    type: 'text',
                    name: 'Email',
                    tooltip: 'Your Raynet email.'
                },
                password: {
                    type: 'password',
                    name: 'Password',
                    tooltip: 'Password to your account.'
                },
                instanceName: {
                    type: 'text',
                    name: 'Instance Name',
                    tooltip: 'Your raynet name: https://app.raynet.cz/instance-name'
                }
            },

            validate: context => {

                let authData = new Buffer(`${context.login}:${context.password}`).toString('base64');

                return request({
                    method: 'GET',
                    url: 'https://app.raynet.cz/api/v2/company/',
                    headers: {
                        'X-Instance-Name': context.instanceName,
                        'authorization': `Basic ${authData}`
                    }
                });
            }
        };
    }
};
