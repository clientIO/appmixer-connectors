
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { richMenuId } = context.messages.in.content;

        // https://developers.line.biz/en/reference/messaging-api/#download-rich-menu-image
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.line.me/v2/bot/richmenu/{richMenuId}/content',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
