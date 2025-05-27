
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { date } = context.messages.in.content;

        // https://developers.line.biz/en/reference/messaging-api/#get-number-of-message-deliveries
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.line.me/v2/bot/insight/message/delivery',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
