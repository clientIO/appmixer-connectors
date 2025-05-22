
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { designId, text } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/api-reference/comments/create-comment
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/v1/comments',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
