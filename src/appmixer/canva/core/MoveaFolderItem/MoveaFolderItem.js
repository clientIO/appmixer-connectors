
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { item_id, source_folder_id, destination_folder_id } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/#move-a-folder-item
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/v1/folder-items/move',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
