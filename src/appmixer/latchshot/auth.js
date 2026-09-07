'use strict';

const lib = require('./lib');

module.exports = {

    type: 'apiKey',

    definition: {

        tokenType: 'authentication-token',

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Create a recurring Free API key at <a href="https://latchshot.fly.dev/?intent=appmixer#trial" target="_blank">latchshot.fly.dev</a>. Keep the <code>ls_live_...</code> value only in this authentication field.'
            }
        },

        requestProfileInfo: async (context) => {

            const apiKey = context.apiKey || '';
            return {
                key: apiKey.length > 8
                    ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
                    : 'Latchshot API key'
            };
        },

        accountNameFromProfileInfo: 'key',

        validate: async (context) => {

            await context.httpRequest({
                method: 'GET',
                url: `${lib.BASE_URL}/v1/usage`,
                headers: {
                    Authorization: `Bearer ${context.apiKey}`
                }
            });
            return true;
        }
    }
};
