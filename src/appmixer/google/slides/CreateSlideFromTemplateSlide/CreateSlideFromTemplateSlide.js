
const lib = require('../lib.generated');
module.exports = {
    async receive(context) {
        const { presentationId, templateSlideId, replacements } = context.messages.in.content;

        // https://developers.google.com/slides/api/reference/rest/v1/presentations/batchUpdate
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://slides.googleapis.com/v1/presentations/{presentationId}:batchUpdate',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
