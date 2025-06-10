'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'BRAVE_API_KEY': {
                    'type': 'text',
                    'name': 'BRAVE_API_KEY'
                }
            },

            validate: async (context) => {
                return Boolean(context['BRAVE_API_KEY']);
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['BRAVE_API_KEY'];
                return name.substring(0, 3) + '...' + name.slice(-3);
            }
        };
    }
};
