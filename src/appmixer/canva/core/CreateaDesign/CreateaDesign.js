
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { name, template_id, dimensions, width, height } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/#create-a-design
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/v1/designs',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
