
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { board_id, name, description } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/boards/#update-board
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: 'https://api.pinterest.com/v5/boards/{board_id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
