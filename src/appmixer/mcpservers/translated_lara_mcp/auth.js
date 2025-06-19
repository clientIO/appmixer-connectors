'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'LARA_ACCESS_KEY_ID': {
                    'type': 'text',
                    'name': 'LARA_ACCESS_KEY_ID'
                },
                'LARA_ACCESS_KEY_SECRET': {
                    'type': 'text',
                    'name': 'LARA_ACCESS_KEY_SECRET'
                }
            },

            validate: async (context) => {
                if (!context['LARA_ACCESS_KEY_ID'] || !context['LARA_ACCESS_KEY_SECRET']) {
                    throw new Error('Invalid credentials.');
                }
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['LARA_ACCESS_KEY_ID'];
                return name.substring(0, 3) + '...' + name.slice(-3);
            }
        };
    }
};
