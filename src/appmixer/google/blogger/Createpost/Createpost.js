
module.exports = {
    async receive(context) {
        const { blogId, isDraft = false, title, content } = context.messages.in.content;


        // https://developers.google.com/blogger/docs/3.0/reference/posts/insert
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`,
            headers: {
                Authorization: `Bearer ${context.auth.accessToken}`
            },
            params: { isDraft },
            data: { title, content }
        });

        return context.sendJson(data, 'out');
    }
};
