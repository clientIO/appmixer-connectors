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
                return true;
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['GOOGLE_MAPS_API_KEY'];
                return name.substr(0, 3) + '...' + name.substr(-3);
            }
        };
    }
};
