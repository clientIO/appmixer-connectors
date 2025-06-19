module.exports = {
    async receive(context) {
        const {
            name,
            subject,
            senderType,
            senderListId,
            senderEmail,
            senderName,
            htmlContent } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#create-email-campaign
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.brevo.com/v3/emailCampaigns',
            headers: {
                'api-key': `${context.auth.apiKey}`
            },
            data: {
                name, htmlContent, subject, sender: {
                    type: senderType,
                    name: senderName || undefined,
                    id: +senderListId || undefined,
                    email: senderEmail || undefined
                }
            }
        });

        return context.sendJson(data, 'out');
    }
};
