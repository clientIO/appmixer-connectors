'use strict';

const FormData = require('form-data');

module.exports = {

    receive: async function(context) {

        const { fileId, responseFormat, model } = context.messages.in.content;
        const apiKey = context.auth.apiKey;

        const readStream = await context.getFileReadStream(fileId);
        const fileInfo = await context.getFileInfo(fileId);
        const formData = new FormData();

        formData.append('file', readStream, {
            filename: fileInfo.filename,
            contentType: fileInfo.contentType,
            knownLength: fileInfo.length
        });
        formData.append('model', model || 'whisper-1');
        formData.append('response_format', responseFormat || 'text');

        const url = 'https://api.openai.com/v1/audio/transcriptions';
        const { data } = await context.httpRequest.post(url, formData, {
            headers: Object.assign({
                'Authorization': `Bearer ${apiKey}`
            }, formData.getHeaders())
        });

        await context.log({ step: 'response', data: (data || '').substring(0, 100) });
        return context.sendJson({ text: data }, 'out');
    }
};
