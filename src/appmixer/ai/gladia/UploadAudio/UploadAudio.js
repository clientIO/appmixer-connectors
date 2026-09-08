'use strict';

const FormData = require('form-data');
const lib = require('../lib');

module.exports = {
    async receive(context) {

        const { fileId } = context.messages.in.content;

        if (!fileId) {
            throw new context.CancelError('Audio file is required!');
        }

        const fileInfo = await context.getFileInfo(fileId);
        const fileStream = await context.getFileReadStream(fileId);

        // Gladia's /v2/upload expects a multipart/form-data body with the file in
        // the `audio` field. It returns the hosted `audio_url` used to start a
        // transcription job.
        const form = new FormData();
        form.append('audio', fileStream, {
            filename: fileInfo.filename,
            contentType: fileInfo.contentType || 'application/octet-stream'
        });

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `${lib.API_BASE_URL}/v2/upload`,
            headers: {
                'x-gladia-key': context.auth.apiKey,
                ...form.getHeaders()
            },
            data: form,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        return context.sendJson(data || {}, 'out');
    }
};
