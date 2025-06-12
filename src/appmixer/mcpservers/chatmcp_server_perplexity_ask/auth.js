'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'PERPLEXITY_API_KEY': {
                    'type': 'text',
                    'name': 'PERPLEXITY_API_KEY'
                }
            },

            validate: async (context) => {
                if (!context['PERPLEXITY_API_KEY']) {
                    throw new Error('Credentials required.');
                }
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['PERPLEXITY_API_KEY'];
                return name.substring(0, 3) + '...' + name.slice(-3);
            }
        };
    }
};
