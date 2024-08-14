'use strict';

const FormData = require('form-data');

module.exports = {

    receive: async function(context) {

        const { fileId } = context.messages.in.content;
        const apiKey = context.config.apiKey;

        if (!apiKey) {
            return new context.CancelError('Missing \'apiKey\' system setting of the appmixer.utils.ai module pointing to OpenAI. Please provide it in the Connector Configuration section of the Appmixer Backoffice.');
        }

        const readStream = await context.getFileReadStream(fileId);
        const fileInfo = await context.getFileInfo(fileId);
        const formData = new FormData();

        formData.append('file', readStream, {
            filename: fileInfo.filename,
            contentType: fileInfo.contentType,
            knownLength: fileInfo.length
        });
        formData.append('model', context.config.CreateTranscriptionModel || 'whisper-1');
        formData.append('response_format', 'json');

        const url = 'https://api.openai.com/v1/audio/transcriptions';
        const { data } = await context.httpRequest.post(url, formData, {
            headers: Object.assign({
                'Authorization': `Bearer ${apiKey}`
            }, formData.getHeaders())
        });

        await context.log({ step: 'response', data: JSON.stringify(data).substring(0, 100) });

        return context.sendJson(data, 'out');
    }
};
