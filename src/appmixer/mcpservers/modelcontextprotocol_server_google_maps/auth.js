'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'GOOGLE_MAPS_API_KEY': {
                    'type': 'text',
                    'name': 'GOOGLE_MAPS_API_KEY'
                }
            },

            validate: async (context) => {
                return Boolean(context['GOOGLE_MAPS_API_KEY']);
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['GOOGLE_MAPS_API_KEY'];
                return name.substring(0, 3) + '...' + name.slice(-3);
            }
        };
    }
};
