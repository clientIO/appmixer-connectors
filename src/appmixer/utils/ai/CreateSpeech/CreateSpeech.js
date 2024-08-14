'use strict';

module.exports = {

    receive: async function(context) {

        const { input, voice, response_format, speed } = context.messages.in.content;
        const apiKey = context.config.apiKey;

        if (!apiKey) {
            return new context.CancelError('Missing \'apiKey\' system setting of the appmixer.utils.ai module pointing to OpenAI. Please provide it in the Connector Configuration section of the Appmixer Backoffice.');
        }

        const url = 'https://api.openai.com/v1/audio/speech';
        const { data: readStream } = await context.httpRequest.post(url, {
            model: context.config.CreateSpeechModel || 'tts-1',
            input,
            voice,
            response_format,
            speed
        }, {
            responseType: 'stream',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const filename = `generated-audio-${(new Date).toISOString()}.${response_format}`;
        const file = await context.saveFileStream(filename, readStream);
        return context.sendJson({ fileId: file.fileId, input, fileSize: file.length }, 'out');
    }
};
