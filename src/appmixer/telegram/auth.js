'use strict';

const lib = require('./lib');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {

            auth: {
                botToken: {
                    type: 'password',
                    name: 'Bot Token',
                    tooltip: 'Open a chat with <i>@BotFather</i> in Telegram, send <i>/newbot</i> (or <i>/mybots</i> for an '
                        + 'existing one) and paste the token here. It looks like '
                        + '<i>123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw</i> and grants full control of the bot, '
                        + 'so treat it as a password.'
                }
            },

            // getMe is the cheapest authenticated call and has no side effects.
            validate: async (context) => {

                await lib.apiRequest(context, 'getMe');
                return true;
            },

            accountNameFromProfileInfo: 'accountName',

            requestProfileInfo: async (context) => {

                const bot = await lib.apiRequest(context, 'getMe');

                return {
                    accountName: bot.username ? `@${bot.username}` : (bot.first_name || 'Telegram Bot'),
                    id: bot.id,
                    username: bot.username,
                    firstName: bot.first_name,
                    canJoinGroups: bot.can_join_groups,
                    canReadAllGroupMessages: bot.can_read_all_group_messages,
                    supportsInlineQueries: bot.supports_inline_queries
                };
            }
        };
    }
};
