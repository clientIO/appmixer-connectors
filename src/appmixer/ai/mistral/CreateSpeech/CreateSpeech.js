'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { text, voice, responseFormat, model } = context.messages.in.content;

        if (!text) {
            throw new context.CancelError('Text is required!');
        }
        // The API rejects a request without a voice ("Either ref_audio or voice
        // must be provided"), so fail early with a message the user can act on.
        if (!voice) {
            throw new context.CancelError('Voice is required!');
        }

        const format = responseFormat || 'mp3';

        const data = {
            input: text,
            voice,
            response_format: format,
            model: model || 'voxtral-mini-tts-latest'
        };

        // https://docs.mistral.ai/api/#tag/audio-speech
        const { data: response } = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl()}/audio/speech`,
            headers: lib.requestHeaders(context, { 'content-type': 'application/json' }),
            data
        });

        const audioBase64 = response?.audio_data;
        if (!audioBase64) {
            throw new context.CancelError('The API did not return any audio data.');
        }

        const buffer = Buffer.from(audioBase64, 'base64');
        const componentLabel = context.flowDescriptor?.[context.componentId]?.label || 'speech';
        const fileName = `${componentLabel.replace(/\W+/g, '-')}-${Date.now()}.${format}`;
        const savedFile = await context.saveFileStream(fileName, buffer);

        return context.sendJson({
            fileId: savedFile.fileId,
            fileName,
            model: response?.model || data.model
        }, 'out');
    }
};
