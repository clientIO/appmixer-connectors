module.exports = {
    async receive(context) {
        const { campaignId, name, subject, sender, type, htmlContent, scheduledAt, recipients } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#update-email-campaign
        const { data } = await context.httpRequest({
            method: 'PUT',
            url: 'https://api.brevo.com/v3/emailCampaigns/{campaignId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
