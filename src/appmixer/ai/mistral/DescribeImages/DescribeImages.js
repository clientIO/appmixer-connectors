'use strict';

const path = require('path');
const lib = require('../lib');

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

module.exports = {

    async receive(context) {

        const { prompt, images, model } = context.messages.in.content;

        if (!prompt) {
            throw new context.CancelError('Prompt is required!');
        }
        if (!images) {
            throw new context.CancelError('Images is required!');
        }

        const imageFileIds = (images.ADD || []).map(image => image.fileId || null).filter(fileId => fileId !== null);
        if (imageFileIds.length === 0) {
            throw new context.CancelError('At least one image file is required!');
        }

        const imageContent = await Promise.all(imageFileIds.map(async (fileId) => {

            const fileInfo = await context.getFileInfo(fileId);
            const fileContent = await context.loadFile(fileId);
            const base64 = fileContent.toString('base64');

            let contentType = fileInfo.contentType;
            if (!contentType) {
                const ext = path.extname(fileInfo.filename).toLowerCase();
                if (ext === '.png') {
                    contentType = 'image/png';
                } else if (ext === '.jpg' || ext === '.jpeg') {
                    contentType = 'image/jpeg';
                } else if (ext === '.gif') {
                    contentType = 'image/gif';
                } else if (ext === '.webp') {
                    contentType = 'image/webp';
                }
            }

            if (!SUPPORTED_TYPES.includes(contentType)) {
                throw new context.CancelError(`Unsupported image type: ${contentType}`);
            }
            return {
                type: 'image_url',
                image_url: `data:${contentType};base64,${base64}`
            };
        }));

        // https://docs.mistral.ai/capabilities/vision/
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl()}/chat/completions`,
            headers: lib.requestHeaders(context, { 'content-type': 'application/json' }),
            data: {
                model: model || 'mistral-small-latest',
                messages: [
                    {
                        role: 'user',
                        content: [{ type: 'text', text: prompt }].concat(imageContent)
                    }
                ]
            }
        });

        const answer = data?.choices?.[0]?.message?.content || '';

        return context.sendJson({ answer, prompt }, 'out');
    }
};
