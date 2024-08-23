'use strict';

const path = require('path');

module.exports = {

    receive: async function(context) {

        const { prompt, images } = context.messages.in.content;
        const apiKey = context.config.apiKey;

        if (!apiKey) {
            throw new context.CancelError('Missing \'apiKey\' system setting of the appmixer.utils.ai module pointing to OpenAI. Please provide it in the Connector Configuration section of the Appmixer Backoffice.');
        }

        const imageFileIds = (images.ADD || [])
              .map(image => (image.fileId || null))
              .filter(fileId => fileId !== null);


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

            if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(contentType)) {
                throw new Error(`Unsupported image type: ${contentType}`);
            }
            return {
                type: 'image_url',
                image_url: {
                    url: `data:${contentType};base64,${base64}`
                }
            };
        }));

        const url = 'https://api.openai.com/v1/chat/completions';
        const payload = {
            model: context.config.DescribeImagesModel || 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [{
                        type: 'text',
                        text: prompt,
                    }].concat(imageContent)
                }
            ]
        };
        const { data } = await context.httpRequest.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        let answer = '';

        if (data && data.choices) {
            answer = data.choices[0].message.content;
        }

        return context.sendJson({ answer, prompt }, 'out');
    }
};
