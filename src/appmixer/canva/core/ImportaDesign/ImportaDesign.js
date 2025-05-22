
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { sourceUrl } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/api-reference/designs/import-design
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/v1/designs/import',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
