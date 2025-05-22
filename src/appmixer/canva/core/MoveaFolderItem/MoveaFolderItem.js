
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { itemId, destinationFolderId } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/api-reference/folders/move-folder-item
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/v1/folders/move',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
