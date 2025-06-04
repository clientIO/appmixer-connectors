
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { folder_id } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/#get-a-folder
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.canva.com/v1/folders/{folder_id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
