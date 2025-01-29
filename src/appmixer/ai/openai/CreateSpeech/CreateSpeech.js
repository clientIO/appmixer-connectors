'use strict';

module.exports = {

    receive: async function(context) {

        const { input, voice, responseFormat, speed, model } = context.messages.in.content;
        const apiKey = context.auth.apiKey;

        const url = 'https://api.openai.com/v1/audio/speech';
        const { data: readStream } = await context.httpRequest.post(url, {
            model: model || 'tts-1',
            input,
            voice,
            response_format: responseFormat,
            speed
        }, {
            responseType: 'stream',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const filename = `generated-audio-${(new Date).toISOString()}.${responseFormat}`;
        const file = await context.saveFileStream(filename, readStream);
        return context.sendJson({ fileId: file.fileId, input, fileSize: file.length }, 'out');
    }
};
