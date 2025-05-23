
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { username, avatar } = context.messages.in.content;

        // https://discord.com/developers/docs/topics/oauth2#current-bot-application
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: 'https://discord.com/api/v10/oauth2/applications/@me/bot',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
