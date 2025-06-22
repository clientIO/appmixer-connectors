module.exports = {
    async receive(context) {
        const { folderId, name } = context.messages.in.content;

        // https://developers.brevo.com/reference/updatefolder-1
        await context.httpRequest({
            method: 'PUT',
            url: `https://api.brevo.com/v3/contacts/folders/${folderId}`,
            headers: {
                'api-key': `${context.auth.apiKey}`
            },
            data: {
                name
            }
        });

        return context.sendJson({ id: folderId }, 'out');
    }
};
