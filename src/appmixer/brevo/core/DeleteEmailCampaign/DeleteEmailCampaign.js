
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { campaignId } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#delete-email-campaign
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: 'https://api.brevo.com/v3/emailCampaigns/{campaignId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
