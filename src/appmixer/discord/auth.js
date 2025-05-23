'use strict';

module.exports = {
    type: 'apiKey',
    definition: {
        auth: {
            botToken: {
                type: 'password',
                name: 'Bot Token',
                tooltip: 'Go to the Discord Developer Portal, select your application, and copy the Bot Token from the Bot section.'
            }
        },

        async requestProfileInfo(context) {
            const botToken = context.botToken;
            // Discord API endpoint to get current bot user
            const url = 'https://discord.com/api/v10/users/@me';
            const headers = {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            };
            const response = await context.httpRequest({ url, method: 'GET', headers });
            if (response.data && response.data.username && response.data.id) {
                return { key: `${response.data.username}#${response.data.discriminator}` };
            } else {
                throw new Error('Could not fetch Discord bot profile info.');
            }
        },

        accountNameFromProfileInfo: 'key',

        validate: async (context) => {
            const url = 'https://discord.com/api/v10/users/@me';
            const headers = {
                'Authorization': `Bot ${context.botToken}`,
                'Content-Type': 'application/json'
            };
            const response = await context.httpRequest({ url, method: 'GET', headers });
            if (!response.data || !response.data.id) {
                throw new Error('Invalid Discord Bot Token.');
            }
            return true;
        }
    }
};
