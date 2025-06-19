module.exports = {
    async receive(context) {
        const { listId } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#delete-list
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: `https://api.brevo.com/v3/contacts/lists/${listId}`,
            headers: {
                'api-key': `${context.auth.apiKey}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
