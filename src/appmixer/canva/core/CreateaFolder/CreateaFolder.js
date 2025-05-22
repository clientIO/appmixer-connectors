
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { name, parentFolderId } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/api-reference/folders/create-folder
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/v1/folders',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
