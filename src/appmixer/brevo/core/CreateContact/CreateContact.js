
module.exports = {
    async receive(context) {
        const { email, attributes, emailBlacklisted, smsBlacklisted, listIds, updateEnabled } = context.messages.in.content;

        const body = {
            email
        };

        // https://developers.brevo.com/docs/getting-started#create-contact
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.brevo.com/v3/contacts',
            headers: {
                'api-key': `${context.auth.apiKey}`
            },
            data: body
        });

        return context.sendJson(data, 'out');
    }
};
