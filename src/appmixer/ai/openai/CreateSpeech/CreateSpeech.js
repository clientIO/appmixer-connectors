'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const { input, voice, responseFormat, speed, model } = context.messages.in.content;

        const { data: readStream } = await lib.request(context, '/audio/speech', {
            model: model || 'tts-1',
            input,
            voice,
            response_format: responseFormat,
            speed
        }, {
            responseType: 'stream'
        });

        const filename = `generated-audio-${(new Date).toISOString()}.${responseFormat}`;
        const file = await context.saveFileStream(filename, readStream);
        return context.sendJson({ fileId: file.fileId, input, fileSize: file.length }, 'out');
    }
};
