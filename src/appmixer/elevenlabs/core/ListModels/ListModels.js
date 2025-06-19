module.exports = {
    async receive(context) {
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.elevenlabs.io/v1/models',
            headers: {
                'xi-api-key': context.auth.apiKey
            }
        });

        return context.sendJson({ models: data }, 'out');
    },

    modelsToSelectArray: function({ models }) {
        return models.map(model => ({
            label: model.name,
            value: model.model_id
        }));
    }
};
