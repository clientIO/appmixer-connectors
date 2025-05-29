
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { sender, recipient, content } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#send-sms
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.brevo.com/v3/sms',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
