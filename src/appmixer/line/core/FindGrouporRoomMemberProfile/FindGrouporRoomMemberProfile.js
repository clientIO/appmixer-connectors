
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { groupId, userId } = context.messages.in.content;

        // https://developers.line.biz/en/reference/messaging-api/#get-group-member-profile
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.line.me/v2/bot/group/{groupId}/member/{userId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
