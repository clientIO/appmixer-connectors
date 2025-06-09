'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'SLACK_BOT_TOKEN': {
                    'type': 'text',
                    'name': 'SLACK_BOT_TOKEN'
                },
                'SLACK_TEAM_ID': {
                    'type': 'text',
                    'name': 'SLACK_TEAM_ID'
                }
            },

            validate: async (context) => {
                return true;
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['SLACK_BOT_TOKEN'];
                return name.substr(0, 3) + '...' + name.substr(-3);
            }
        };
    }
};
