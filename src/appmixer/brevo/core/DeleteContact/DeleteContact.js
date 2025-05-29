
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { contactId } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#delete-contact
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: 'https://api.brevo.com/v3/contacts/{contactId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
