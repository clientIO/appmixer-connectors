module.exports = {

    async receive(context) {

        const { audienceId } = context.messages.in.content;
        const accessToken = context.auth.accessToken;

        const url = `https://graph.facebook.com/v20.0/${audienceId}?access_token=${accessToken}`;
        const { data } = await context.httpRequest.delete(url);
        return context.sendJson({ id: audienceId, ...data }, 'out');
    }
};
