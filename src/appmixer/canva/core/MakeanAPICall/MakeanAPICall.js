
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { path, method, body, query_params } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/#make-an-api-call
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/v1/{path}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
