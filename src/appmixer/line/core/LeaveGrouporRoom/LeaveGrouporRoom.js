
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { groupId, roomId } = context.messages.in.content;

        // https://developers.line.biz/en/reference/messaging-api/#leave-group
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.line.me/v2/bot/group/{groupId}/leave',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
