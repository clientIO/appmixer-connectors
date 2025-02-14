'use strict';

module.exports = {

    receive: async function(context) {
        const { prompt } = context.messages.in.content;
        const apiKey = context.auth.apiKey;

        const url = 'https://api.openai.com/v1/models';
        const { data } = await context.httpRequest.get(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        return context.sendJson({ models: data.data }, 'out');
    },

    toSelectOptions(out) {
        return out.models.map(model => {
            return { label: model.id, value: model.id };
        });
    }
};
