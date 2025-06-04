
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { noteId } = context.messages.in.content;

        // https://developers.hubspot.com/docs/api/crm/notes
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: '/crm/v3/objects/notes/{noteId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
