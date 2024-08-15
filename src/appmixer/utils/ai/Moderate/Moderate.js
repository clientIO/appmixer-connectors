'use strict';

module.exports = {

    receive: async function(context) {

        const { input } = context.messages.in.content;
        const apiKey = context.config.apiKey;

        if (!apiKey) {
            return new context.CancelError('Missing \'apiKey\' system setting of the appmixer.utils.ai module pointing to OpenAI. Please provide it in the Connector Configuration section of the Appmixer Backoffice.');
        }

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
            return context.sendJson({ moderation, input }, 'out');
        }
    }
};
