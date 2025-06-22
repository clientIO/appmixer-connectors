module.exports = {
    async receive(context) {
        const {
            campaignId,
            name,
            subject,
            senderType,
            senderId,
            senderEmail,
            senderName,
            htmlContent } = context.messages.in.content;

        // https://developers.brevo.com/reference/updateemailcampaign
        await context.httpRequest({
            method: 'PUT',
            url: `https://api.brevo.com/v3/emailCampaigns/${campaignId}`,
            headers: {
                'api-key': `${context.auth.apiKey}`
            },
            data: {
                name, htmlContent, subject, sender: {
                    type: senderType,
                    name: senderName || undefined,
                    id: +senderId || undefined,
                    email: senderEmail || undefined
                }
            }
        });

        return context.sendJson({ id: campaignId }, 'out');
    }
};
