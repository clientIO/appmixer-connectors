
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { messageId } = context.messages.in.content;

        // https://developers.line.biz/en/reference/messaging-api/#get-content
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api-data.line.me/v2/bot/message/{messageId}/content',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
