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

                const params = new URLSearchParams();
                params.append('token', context['SLACK_BOT_TOKEN']);
                const { data } = await context.httpRequest.post('https://slack.com/api/auth.test', params);
                return data.ok;
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['SLACK_BOT_TOKEN'];
                return name.substring(0, 3) + '...' + name.slice(-3);
            }
        };
    }
};
