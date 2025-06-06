module.exports = {
    async receive(context) {
        const { name, subject, image_urls, image_upload_tokens } = context.messages.in.content;

        const payload = {
            name,
            subject
        };

        if (image_urls.AND.length > 0) {
            payload.image_urls = image_urls.AND.map(item => item['image_urls_item']);
        } else if (image_upload_tokens.AND.length > 0) {
            payload.image_upload_tokens = image_upload_tokens.AND.map(item => item['image_upload_tokens_item']);
        } else {
            return context.CancelError('At least one of "Image Upload Tokens" or "Image Urls" must be provided.');
        }

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
