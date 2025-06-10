'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'EVERART_API_KEY': {
                    'type': 'text',
                    'name': 'EVERART_API_KEY'
                }
            },

            validate: async (context) => {
                if (!context['EVERART_API_KEY']) {
                    throw new Error('Invalid credentials.');
                }
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['EVERART_API_KEY'];
                return name.substring(0, 3) + '...' + name.slice(-3);
            }
        };
    }
};
