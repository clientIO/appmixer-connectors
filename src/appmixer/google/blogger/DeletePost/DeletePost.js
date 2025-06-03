module.exports = {
    async receive(context) {
        const { blogId, postId } = context.messages.in.content;

        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${postId}`,
            headers: {
                Authorization: `Bearer ${context.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
