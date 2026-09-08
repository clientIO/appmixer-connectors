'use strict';

const FormData = require('form-data');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { file, fileUrl, model, language } = context.messages.in.content;

        if (!file && !fileUrl) {
            throw new context.CancelError('Either Audio File or Audio File URL is required!');
        }

        const form = new FormData();
        form.append('model', model || 'voxtral-mini-latest');

        if (file) {
            const fileStream = await context.getFileReadStream(file);
            const fileInfo = await context.getFileInfo(file);
            form.append('file', fileStream, {
                filename: fileInfo.filename,
                contentType: fileInfo.contentType,
                knownLength: fileInfo.length
            });
        } else {
            form.append('file_url', fileUrl);
        }

        if (language) {
            form.append('language', language);
        }

        // https://docs.mistral.ai/api/#tag/audio-transcriptions
        const response = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl()}/audio/transcriptions`,
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${context.auth.apiKey}`
            },
            data: form
        });

        const outputData = {
            text: response.data?.text,
            language: response.data?.language,
            model: response.data?.model
        };

        return context.sendJson(outputData, 'out');
    }
};
