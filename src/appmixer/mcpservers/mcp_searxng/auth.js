'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'SEARXNG_URL': {
                    'type': 'text',
                    'name': 'SEARXNG_URL',
                    'tooltip': 'Note that the SearxNG instance must have the json output format enabled. An example of a public instance: https://searx.perennialte.ch/.'
                },
                'AUTH_USERNAME': {
                    'type': 'text',
                    'name': 'AUTH_USERNAME',
                    'tooltip': 'Optional. Use only if you are using a password protected SearxNG instance.'
                },
                'AUTH_PASSWORD': {
                    'type': 'password',
                    'name': 'AUTH_PASSWORD',
                    'tooltip': 'Optional. Use only if you are using a password protected SearxNG instance.'
                }
            },

            validate: async (context) => {
                if (!context['SEARXNG_URL']) {
                    throw new Error('SEARXNG_URL cannot be empty.');
                }
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['SEARXNG_URL'];
                return name;
            }
        };
    }
};
