
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { id } = context.messages.in.content;

        // https://www.everart.ai/api/docs
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.everart.ai/v1/generations/{id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
