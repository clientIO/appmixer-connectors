
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { blogId } = context.messages.in.content;
        const { auth } = context;

        context.log({ step: 'auth', auth });

        // https://developers.google.com/blogger/docs/3.0/reference/blogs/get
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://www.googleapis.com/blogger/v3/blogs/${blogId}?key=${auth.apiKey}`,
        });

        return context.sendJson(data, 'out');
    }
};
