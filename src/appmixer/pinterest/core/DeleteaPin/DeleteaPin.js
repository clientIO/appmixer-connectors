
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { pin_id } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/pins/#delete-pin
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: 'https://api.pinterest.com/v5/pins/{pin_id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
