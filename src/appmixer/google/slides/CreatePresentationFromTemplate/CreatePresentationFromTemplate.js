
const lib = require('../lib.generated');
module.exports = {
    async receive(context) {
        const { templateId, replacements } = context.messages.in.content;

        // https://developers.google.com/slides/api/guides/presentations
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://slides.googleapis.com/v1/presentations:createFromTemplate',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
