'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'COINCAP_API_KEY': {
                    'type': 'text',
                    'name': 'COINCAP_API_KEY'
                }
            },

            validate: async (context) => {
                if (!context['COINCAP_API_KEY']) {
                    throw new Error('Invalid credentials.');
                }
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['COINCAP_API_KEY'];
                return name.substring(0, 3) + '...' + name.slice(-3);
            }
        };
    }
};
