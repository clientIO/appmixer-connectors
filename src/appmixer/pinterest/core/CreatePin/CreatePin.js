
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { board_id, title, description, image_url } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/pins/#create-pin
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.pinterest.com/v5/pins',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
