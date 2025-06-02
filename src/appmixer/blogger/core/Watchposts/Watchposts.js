
module.exports = {
    async receive(context) {
        const { blogId } = context.messages.in.content;

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/watch`,
            headers: {
                Authorization: `Bearer ${context.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
