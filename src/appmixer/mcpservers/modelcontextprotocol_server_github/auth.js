'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'GITHUB_PERSONAL_ACCESS_TOKEN': {
                    'type': 'text',
                    'name': 'GITHUB_PERSONAL_ACCESS_TOKEN'
                }
            },

            validate: async (context) => {
                return Boolean(context['GITHUB_PERSONAL_ACCESS_TOKEN']);
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['GITHUB_PERSONAL_ACCESS_TOKEN'];
                return name.substring(0, 3) + '...' + name.slice(-3);
            }
        };
    }
};
