module.exports = {
    async receive(context) {
        const { campaignId } = context.messages.in.content;

        // https://developers.brevo.com/reference/deleteemailcampaign
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: `https://api.brevo.com/v3/emailCampaigns/${campaignId}`,
            headers: {
                'api-key': `${context.auth.apiKey}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
