
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { voice_id, text } = context.messages.in.content;

        // https://elevenlabs.io/docs/api-reference/text-to-speech/convert
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.elevenlabs.io/v1/text-to-speech/convert',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
