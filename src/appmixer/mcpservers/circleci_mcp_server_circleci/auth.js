'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'CIRCLECI_TOKEN': {
                    'type': 'text',
                    'name': 'CIRCLECI_TOKEN'
                },
                'CIRCLECI_BASE_URL': {
                    'type': 'text',
                    'name': 'CIRCLECI_BASE_URL',
                    'tooltip': 'Optional. Required for on-prem customers only.'
                }
            },

            validate: async (context) => {
                if (!context['CIRCLECI_TOKEN']) {
                    throw new Error('Invalid credentials.');
                }
                const baseUrl = context['CIRCLECI_BASE_URL'] || 'https://circleci.com';
                const { data } = await context.httpRequest.get(`${baseUrl.replace(/\/+$/, '')}/api/v2/me`, {
                    headers: {
                        'Circle-Token': context['CIRCLECI_TOKEN']
                    }
                });
                if (!data.id) {
                    throw new Error('Invalid credentials.');
                }
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['CIRCLECI_TOKEN'];
                return name.substring(0, 3) + '...' + name.slice(-3);
            }
        };
    }
};
