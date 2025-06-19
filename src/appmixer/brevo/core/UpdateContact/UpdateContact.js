module.exports = {
    async receive(context) {
        const { contactId, email, emailBlacklisted, smsBlacklisted, listIds } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#update-contact
        const { data } = await context.httpRequest({
            method: 'PUT',
            url: `https://api.brevo.com/v3/contacts/${contactId}`,
            headers: {
                'api-key': `${context.auth.apiKey}`
            },
            data: {
                email, emailBlacklisted, smsBlacklisted, listIds
            }
        });

        return context.sendJson(data, 'out');
    }
};
