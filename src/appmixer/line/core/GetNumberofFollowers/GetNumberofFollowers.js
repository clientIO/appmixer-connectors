module.exports = {
    async receive(context) {
        const { date } = context.messages.in.content;

        // https://developers.line.biz/en/reference/messaging-api/#get-number-of-followers
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.line.me/v2/bot/insight/followers',
            headers: {
                'Authorization': `Bearer ${context.auth.channelAccessToken}`
            },
            params: {
                date
            }
        });

        return context.sendJson(data, 'out');
    }
};
