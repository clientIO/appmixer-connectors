module.exports = {
    async receive(context) {
        const { folderId } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#get-folder
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://api.brevo.com/v3/contacts/folders/${folderId}`,
            headers: {
                'api-key': `${context.auth.apiKey}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
