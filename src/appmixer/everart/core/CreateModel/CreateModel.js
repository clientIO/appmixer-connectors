module.exports = {
    async receive(context) {
        const { name, subject, image_urls: imageUrls } = context.messages.in.content;

        const payload = {
            name,
            subject
        };

        if (!Array.isArray(imageUrls?.AND) || imageUrls.AND.length === 0) {
            throw new context.CancelError('"Image Urls" must be provided.');
        }

        payload.image_urls = imageUrls.AND.map(item => item['image_urls_item']);

        // https://www.everart.ai/api/docs/#/Models/post_models_post
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.everart.ai/v1/models',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            },
            data: payload
        });

        await context.log({ step: 'rq', rqPayload: payload, response: data });

        return context.sendJson(data.model, 'out');
    }
};
