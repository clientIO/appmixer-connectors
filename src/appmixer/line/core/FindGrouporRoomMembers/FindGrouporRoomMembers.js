
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { groupId } = context.messages.in.content;

        // https://developers.line.biz/en/reference/messaging-api/#get-group-member-user-ids
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.line.me/v2/bot/group/{groupId}/members/ids',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
