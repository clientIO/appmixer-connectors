
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { id, name, thumbnail_upload_token } = context.messages.in.content;

        const body = {};
        if (name !== undefined) {
            body.name = name;
        }
        if (thumbnail_upload_token !== undefined) {
            body.thumbnail_upload_token = thumbnail_upload_token;
        }

        // https://www.everart.ai/api/docs/#/Models/patch_models__id__patch
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: `https://api.everart.ai/v1/models/${id}`,
            headers: {
                'Authorization': `Bearer ${context.apiKey}`
            },
            json: body
        });

        return context.sendJson(data, 'out');
    }
};
