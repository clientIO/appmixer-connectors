
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const {  } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#get-my-account
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.brevo.com/v3/account',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
