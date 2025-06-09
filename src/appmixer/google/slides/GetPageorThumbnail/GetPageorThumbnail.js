module.exports = {
    async receive(context) {
        const { presentationId, pageObjectId } = context.messages.in.content;

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://slides.googleapis.com/v1/presentations/${presentationId}/pages/${pageObjectId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
