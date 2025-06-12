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
                const url = context['SEARXNG_URL'];
                if (!url) {
                    throw new Error('SEARXNG_URL cannot be empty.');
                }
                try {
                    // Throws if invalid, covers protocol / hostname sanity.
                    new URL(url);
                } catch {
                    throw new Error('SEARXNG_URL must be a valid absolute URL.');
                }
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['SEARXNG_URL'];
                return name;
            }
        };
    }
};
