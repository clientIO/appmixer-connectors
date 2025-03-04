'use strict';

module.exports = {

    receive: async function(context) {

        const { prompt, size, model } = context.messages.in.content;
        const apiKey = context.auth.apiKey;

        const url = 'https://api.openai.com/v1/images/generations';
        const { data } = await context.httpRequest.post(url, {
            model: model || 'dall-e-3',
            prompt,
            size,
            n: 1
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        let imageUrl;
        if (data && data.data && data.data.length > 0) {
            imageUrl = data.data[0].url;
        }

        if (imageUrl) {
            const response = await context.httpRequest.get(imageUrl, { responseType: 'stream' });
            const readStream = response.data;
            const filename = `generated-image-${(new Date).toISOString()}.png`;
            const file = await context.saveFileStream(filename, readStream);
            return context.sendJson({ fileId: file.fileId, prompt, size }, 'out');
        }
    }
};
