
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { board_id } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/boards/#delete-board
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: 'https://api.pinterest.com/v5/boards/{board_id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
