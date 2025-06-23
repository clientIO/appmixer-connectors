'use strict';

module.exports = {
    async receive(context) {

        // https://console.groq.com/docs/api-reference#models
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.groq.com/openai/v1/models',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            }
        });

        return context.sendJson(data.data, 'out');
    },

    modelsToSelectArray(models) {
        if (!Array.isArray(models)) return [];
        return models.map(model => ({
            label: model.id,
            value: model.id
        }));
    }
};
