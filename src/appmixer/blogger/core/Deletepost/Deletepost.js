
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { blogId, postId } = context.messages.in.content;

        // https://developers.google.com/blogger/docs/3.0/reference/posts/delete
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: 'https://www.googleapis.com/blogger/v3/blogs/{blogId}/posts/{postId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
