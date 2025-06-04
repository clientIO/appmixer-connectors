
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { file_name, file_data, folder_id } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/#upload-an-image
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/v1/images/upload',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
