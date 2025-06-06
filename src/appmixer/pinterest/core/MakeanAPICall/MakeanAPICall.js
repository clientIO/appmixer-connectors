
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { endpoint, http_method, payload } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/introduction/
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.pinterest.com/v5/{endpoint}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
