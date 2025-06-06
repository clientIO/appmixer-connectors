
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { id, name, thumbnail_upload_token } = context.messages.in.content;

        // https://www.everart.ai/api/docs
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: 'https://api.everart.ai/v1/models/{id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
