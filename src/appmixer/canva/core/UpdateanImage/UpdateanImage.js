
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { imageId, name } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/api-reference/images/update-image
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: 'https://api.canva.com/v1/images/{imageId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
