
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { name, subject, sender, type, htmlContent, scheduledAt, recipients } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#create-email-campaign
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.brevo.com/v3/emailCampaigns',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
