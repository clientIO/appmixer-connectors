'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const { prompt, size, model } = context.messages.in.content;
        const { data } = await lib.request(context, 'post', '/images/generations', {
            model: model || 'dall-e-3',
            prompt,
            size,
            n: 1
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
