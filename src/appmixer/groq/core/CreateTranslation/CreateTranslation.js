
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { mediaUrl, sourceLanguage } = context.messages.in.content;

        // https://console.groq.com/docs/api-reference#translation
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.groq.com/v1/audio/translation',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
