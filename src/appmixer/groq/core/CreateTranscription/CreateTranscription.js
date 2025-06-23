
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { audioUrl, language } = context.messages.in.content;

        // https://console.groq.com/docs/api-reference#transcription
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.groq.com/v1/audio/transcription',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
