
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { folderId, name } = context.messages.in.content;

        // https://developers.brevo.com/docs/getting-started#update-folder
        const { data } = await context.httpRequest({
            method: 'PUT',
            url: 'https://api.brevo.com/v3/contacts/folders/{folderId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
