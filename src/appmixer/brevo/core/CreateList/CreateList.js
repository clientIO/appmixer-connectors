module.exports = {
    async receive(context) {
        const { name, folderId } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#create-list
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.brevo.com/v3/contacts/lists',
            headers: {
                'api-key': `${context.auth.apiKey}`
            },
            data: {
                name, folderId
            }
        });

        return context.sendJson(data, 'out');
    }
};
