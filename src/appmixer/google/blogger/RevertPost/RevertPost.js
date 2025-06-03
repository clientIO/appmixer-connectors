
module.exports = {
    async receive(context) {
        const { blogId, postId } = context.messages.in.content;

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${postId}/revert`,
            headers: {
                Authorization: `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
