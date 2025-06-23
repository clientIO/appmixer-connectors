module.exports = {
    async receive(context) {
        const { id } = context.messages.in.content;

        // https://www.everart.ai/api/docs/#/Model/get_models__id__get
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://api.everart.ai/v1/models/${id}`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            }
        });

        return context.sendJson(data.model, 'out');
    }
};
