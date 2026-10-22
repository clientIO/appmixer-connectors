'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const { input, voice, responseFormat, speed, model } = context.messages.in.content;
        if (!input) {
            throw new context.CancelError('Text is required');
        }


        const format = responseFormat || 'mp3';
        const { data: readStream } = await lib.request(context, 'post', '/audio/speech', {
            model: model || 'tts-1',
            input,
            voice,
            response_format: format,
            speed
        }, {
            responseType: 'stream'
        });

        const filename = `generated-audio-${(new Date).toISOString()}.${format}`;
        const file = await context.saveFileStream(filename, readStream);
        return context.sendJson({ fileId: file.fileId, input, fileSize: file.length }, 'out');
    }
};
