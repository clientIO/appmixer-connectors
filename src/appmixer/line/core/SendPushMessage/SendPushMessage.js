module.exports = {
    async receive(context) {
        const { to, messages, notificationDisabled } = context.messages.in.content;

        const messagesArr = messages.ADD.map((message) => {
            return {
                type: message.type,
                text: message.text,
                packageId: message.packageId,
                stickerId: message.stickerId
            };
        });

        // https://developers.line.biz/en/reference/messaging-api/#send-push-message
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.line.me/v2/bot/message/push',
            headers: {
                'Authorization': `Bearer ${context.auth.channelAccessToken}`
            },
            data: {
                to,
                notificationDisabled,
                messages: messagesArr
            }
        });

        return context.sendJson(data, 'out');
    }
};
