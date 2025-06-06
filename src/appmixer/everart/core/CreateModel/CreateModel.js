
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { name, subject, image_urls, image_upload_tokens } = context.messages.in.content;

        // https://www.everart.ai/api/docs
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.everart.ai/v1/models',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
