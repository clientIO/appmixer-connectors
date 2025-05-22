
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { file, name } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/api-reference/images/upload-image
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
