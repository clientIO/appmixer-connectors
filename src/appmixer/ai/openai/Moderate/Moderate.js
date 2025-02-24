'use strict';

module.exports = {

    receive: async function(context) {

        const { input } = context.messages.in.content;
        const apiKey = context.auth.apiKey;

        const url = 'https://api.openai.com/v1/moderations';
        const { data } = await context.httpRequest.post(url, {
            model: context.config.ModerateModel || 'text-moderation-latest',
            input
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (data.results) {
            const moderation = data.results[0];

            if (moderation.flagged) {
                return context.sendJson({ moderation, input }, 'IsFlagged');
            } else {
                return context.sendJson({ moderation, input }, 'NotFlagged');
            }
        }
    }
};
