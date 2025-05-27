
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { to, messages } = context.messages.in.content;

        // https://developers.line.biz/en/reference/messaging-api/#send-push-message
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.line.me/v2/bot/message/push',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
