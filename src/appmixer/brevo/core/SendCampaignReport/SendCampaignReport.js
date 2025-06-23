'use-strict';

module.exports = {
    async receive(context) {
        const { campaignId, subject, to, contentType, body, bcc, cc } = context.messages.in.content;

        // https://developers.brevo.com/reference/sendreport-1
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendReport`,
            headers: {
                'api-key': `${context.auth.apiKey}`
            },
            data: {
                email: {
                    body,
                    contentType,
                    subject,
                    to: to?.split(','),
                    bcc: bcc?.split(','),
                    cc: cc?.split(',')
                }
            }
        });

        return context.sendJson(data, 'out');
    }
};
