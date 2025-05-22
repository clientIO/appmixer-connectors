
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { commentId, text } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/api-reference/comments/create-comment-reply
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/v1/comments/{commentId}/replies',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
