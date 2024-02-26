'use strict';
const Pipedrive = require('pipedrive');
const Promise = require('bluebird');

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API key',
                tooltip: 'Log into your Pipedrive account and find ' +
                    '<i>Your personal API token (Settings &gt; Personal &gt; API)</i>.'
            }
        },

        accountNameFromProfileInfo: 'email',

        requestProfileInfo: context => {

            const pipedrive = new Pipedrive.Client(context.apiKey, { strictMode: true });
            const getAllUsers = Promise.promisify(pipedrive.Users.getAll, { context: pipedrive.Users });

            return getAllUsers()
                .then(data => {
                    let profileInfo = data.find(item => item['is_you']);
                    if (!profileInfo) {
                        throw new Error('Couldn\'t find profile info user');
                    }
                    return {
                        name: profileInfo.name,
                        email: profileInfo.email
                    };
                });
        },

        validate: async context => {

            const pipedrive = new Pipedrive.Client(context.apiKey, { strictMode: true });
            const getAllDeals = Promise.promisify(pipedrive.Deals.getAll, { context: pipedrive.Deals });
            try {
                return await getAllDeals({ limit: 1 });
            } catch (err) {
                if (err.message && err.message === 'Pipedrive API error:unauthorized access') {
                    throw new context.InvalidTokenError(err.message);
                }
                throw err;
            }
        }
    }
};
