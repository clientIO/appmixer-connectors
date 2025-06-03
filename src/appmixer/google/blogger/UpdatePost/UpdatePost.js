
module.exports = {
    async receive(context) {
        const { blogId, postId, title, content } = context.messages.in.content;

        const { data } = await context.httpRequest({
            method: 'PUT',
            url: `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${postId}`,
            headers: {
                Authorization: `Bearer ${context.auth.accessToken}`
            },
            data: { title, content }
        });

        return context.sendJson(data, 'out');
    }
};
