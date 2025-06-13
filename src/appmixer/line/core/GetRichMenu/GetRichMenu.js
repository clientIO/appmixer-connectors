module.exports = {
    async receive(context) {
        const { richMenuId } = context.messages.in.content;

        // https://developers.line.biz/en/reference/messaging-api/#get-rich-menu
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://api.line.me/v2/bot/richmenu/${richMenuId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.channelAccessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
