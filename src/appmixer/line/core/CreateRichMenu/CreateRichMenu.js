
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { size, width, height, selected, name, chatBarText, areas, bounds, x, y, action } = context.messages.in.content;

        // https://developers.line.biz/en/reference/messaging-api/#create-rich-menu
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.line.me/v2/bot/richmenu',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
