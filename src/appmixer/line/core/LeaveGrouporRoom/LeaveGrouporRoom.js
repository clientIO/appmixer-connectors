module.exports = {
    async receive(context) {
        const { groupId, roomId } = context.messages.in.content;

        // https://developers.line.biz/en/reference/messaging-api/#leave-group
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://api.line.me/v2/bot/${groupId ? 'group/' + groupId : 'room/' + roomId}/leave`,
            headers: {
                'Authorization': `Bearer ${context.auth.channelAccessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
