module.exports = {
    async receive(context) {
        const { id, name } = context.messages.in.content;

        const payload = {};
        if (name !== undefined) {
            payload.name = name;
        }

        // https://www.everart.ai/api/docs/#/Models/patch_models__id__patch
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: `https://api.everart.ai/v1/models/${id}`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            },
            data: payload
        });

        return context.sendJson(data, 'out');
    }
};
