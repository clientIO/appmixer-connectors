'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'GITLAB_PERSONAL_ACCESS_TOKEN': {
                    'type': 'text',
                    'name': 'GITLAB_PERSONAL_ACCESS_TOKEN'
                },
                'GITLAB_API_URL': {
                    'type': 'text',
                    'name': 'GITLAB_API_URL',
                    'tooltip': 'Optional. Only for self-hosted tenants.'
                }
            },

            validate: async (context) => {
                if (!context['GITLAB_PERSONAL_ACCESS_TOKEN']) {
                    throw new Error('Invalid credentials.');
                }
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['GITLAB_PERSONAL_ACCESS_TOKEN'];
                return name.substring(0, 3) + '...' + name.slice(-3);
            }
        };
    }
};
