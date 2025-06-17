module.exports = {
    async receive(context) {
        const { to, email, name, subject, htmlContent, sender, cc, bcc, replyTo, attachmentUrls } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#send-email
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.brevo.com/v3/smtp/email',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
