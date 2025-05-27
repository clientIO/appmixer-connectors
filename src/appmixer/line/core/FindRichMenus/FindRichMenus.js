
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        // https://developers.line.biz/en/reference/messaging-api/#get-rich-menu-list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.line.me/v2/bot/richmenu/list',
            headers: {
                'Authorization': `Bearer ${context.auth.channelAccessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
