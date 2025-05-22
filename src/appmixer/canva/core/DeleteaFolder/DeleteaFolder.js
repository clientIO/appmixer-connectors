
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { folderId } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/api-reference/folders/delete-folder
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: 'https://api.canva.com/v1/folders/{folderId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
