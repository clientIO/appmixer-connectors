
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { blogId } = context.messages.in.content;

        // https://developers.google.com/blogger/docs/3.0/using#watching-posts
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://www.googleapis.com/blogger/v3/blogs/{blogId}/posts/watch',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
