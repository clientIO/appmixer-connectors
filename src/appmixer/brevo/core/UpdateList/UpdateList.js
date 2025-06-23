'use-strict';

module.exports = {
    async receive(context) {
        const { listId, name, folderId } = context.messages.in.content;

        // https://developers.brevo.com/reference/updatelist
        await context.httpRequest({
            method: 'PUT',
            url: `https://api.brevo.com/v3/contacts/lists/${listId}`,
            headers: {
                'api-key': `${context.auth.apiKey}`
            },
            data: name ? { name } : { folderId }
        });

        return context.sendJson({ id: listId }, 'out');
    }
};
