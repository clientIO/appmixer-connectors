
module.exports = {
    async receive(context) {
        const { blogId } = context.messages.in.content;

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://www.googleapis.com/blogger/v3/blogs/${blogId}`,
            headers: {
                Authorization: `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
