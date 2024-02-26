'use strict';
const ActiveCampaign = require('./ActiveCampaign');

module.exports = {

    type: 'apiKey',

    definition: {

        tokenType: 'authentication-token',

        auth: {
            url: {
                type: 'text',
                name: 'URL',
                tooltip: 'Your ActiveCampaign URL. You can find it in your account inside Settings > Developer'
            },
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Your ActiveCampaign Api Key. You can find it in your account inside Settings > Developer'
            }
        },

        accountNameFromProfileInfo: 'user.email',

        requestProfileInfo: async context => {

            const ac = new ActiveCampaign(context.url, context.apiKey);
            const { data } = await ac.call('get', 'users/me');
            return data;
        },

        validate: async context => {

            const ac = new ActiveCampaign(context.url, context.apiKey);
            const { status } = await ac.call('get', 'users/me');
            return status === 200;
        }
    }
};
