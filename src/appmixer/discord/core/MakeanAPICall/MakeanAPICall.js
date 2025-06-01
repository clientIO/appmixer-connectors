
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { endpoint, method, body } = context.messages.in.content;

        // https://discord.com/developers/docs/reference
        const { data } = await context.httpRequest({
            method: 'GET',
            url: '',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
