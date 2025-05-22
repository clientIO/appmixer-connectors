
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { imageId } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/api-reference/images/get-image
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.canva.com/v1/images/{imageId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
