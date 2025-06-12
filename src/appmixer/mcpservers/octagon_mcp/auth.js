'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'OCTAGON_API_KEY': {
                    'type': 'text',
                    'name': 'OCTAGON_API_KEY'
                }
            },

            validate: async (context) => {
                if (!context['OCTAGON_API_KEY']) {
                    throw new Error('Invalid credentials.');
                }
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['OCTAGON_API_KEY'];
                return name.substring(0, 3) + '...' + name.slice(-3);
            }
        };
    }
};
