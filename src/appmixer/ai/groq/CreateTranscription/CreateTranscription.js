'use strict';

const FormData = require('form-data');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const {
            model,
            file,
            language,
            prompt,
            temperature
        } = context.messages.in.content;

        // Validate required inputs
        if (!model) {
            throw new context.CancelError('Model is required!');
        }
        if (!file) {
            throw new context.CancelError('File is required!');
        }

        // Resolve the metadata first so a missing file fails before a stream is opened.
        const fileInfo = await context.getFileInfo(file);
        const fileStream = await context.getFileReadStream(file);

        const form = new FormData();
        form.append('model', model);
        form.append('file', fileStream, {
            filename: fileInfo.filename,
            contentType: fileInfo.contentType,
            knownLength: fileInfo.length
        });

        if (language) form.append('language', language);
        if (prompt) form.append('prompt', prompt);
        if (temperature !== undefined && temperature !== null) form.append('temperature', String(temperature));

        let data;
        try {
            ({ data } = await lib.request({
                context,
                method: 'POST',
                path: '/audio/transcriptions',
                headers: form.getHeaders(),
                data: form
            }));
        } catch (error) {
            // A failed upload must not leave the file read stream (and its descriptor) open.
            fileStream.destroy();
            throw error;
        }

        return context.sendJson(data, 'out');
    }
};
