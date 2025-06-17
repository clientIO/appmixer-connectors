
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { listId, contactEmails } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#add-existing-contacts-to-a-list
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://api.brevo.com/v3/contacts/lists/${listId}/contacts/add`,
            headers: {
                'api-key': `${context.auth.apiKey}`
            },
            data: {
                emails: contactEmails.split(',')
            }
        });

        return context.sendJson(data, 'out');
    }
};
