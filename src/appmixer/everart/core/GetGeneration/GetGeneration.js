
module.exports = {
    async receive(context) {
        const { id } = context.messages.in.content;

        // https://www.everart.ai/api/docs#tag/Generations/operation/getGeneration
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://api.everart.ai/v1/generations/${id}`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            }
        });

        return context.sendJson(data.generation, 'out');
    }
};
