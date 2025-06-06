
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { images, filename, content_type, id } = context.messages.in.content;

        // Prepare array of upload items
        const items = Array.isArray(images) && images.length
            ? images
            : [{ filename, content_type, id }];

        // https://www.everart.ai/api/docs#tag/Assets/operation/getImageUploads
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.everart.ai/v1/images/uploads',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            },
            json: { images: items }
        });

        return context.sendJson(data, 'out');
    }
};
