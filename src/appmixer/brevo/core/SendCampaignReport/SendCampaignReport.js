
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { campaignId, email } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#send-campaign-report
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.brevo.com/v3/emailCampaigns/{campaignId}/report',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
