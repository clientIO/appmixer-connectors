
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { listId, name, folderId } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#update-list
        const { data } = await context.httpRequest({
            method: 'PUT',
            url: 'https://api.brevo.com/v3/contacts/lists/{listId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
