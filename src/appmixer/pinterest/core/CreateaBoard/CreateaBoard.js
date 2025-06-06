
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { name, description } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/boards/#create-board
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.pinterest.com/v5/boards',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
