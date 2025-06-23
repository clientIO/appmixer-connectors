'use strict';

const FormData = require('form-data');

module.exports = {
    async receive(context) {
        const {
            model,
            file,
            language,
            prompt,
            responseFormat,
            temperature
        } = context.messages.in.content;

        const fileStream = await context.getFileReadStream(file);
        const fileInfo = await context.getFileInfo(file);

        const form = new FormData();
        form.append('model', model);
        form.append('file', fileStream, {
            filename: fileInfo.filename,
            contentType: fileInfo.contentType,
            knownLength: fileInfo.length
        });

        if (language) form.append('language', language);
        if (prompt) form.append('prompt', prompt);
        if (responseFormat) form.append('response_format', responseFormat);
        if (temperature !== undefined) form.append('temperature', temperature.toString());

        const response = await context.httpRequest({
            method: 'POST',
            url: 'https://api.groq.com/openai/v1/audio/transcriptions',
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${context.auth.apiToken}`
            },
            data: form
        });

        return context.sendJson(response.data, 'out');
    }
};
