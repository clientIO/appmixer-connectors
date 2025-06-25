/* eslint-disable camelcase */
'use strict';

module.exports = {
    async receive(context) {

        const {
            voice_id,
            text,
            model_id,
            language_code,
            seed
        } = context.messages.in.content;

        // https://elevenlabs.io/docs/api-reference/text-to-speech/convert
        let data;
        try {
            const response = await context.httpRequest({
                method: 'POST',
                url: `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
                headers: {
                    'xi-api-key': context.auth.apiKey
                },
                data: {
                    text,
                    model_id,
                    language_code,
                    seed
                },
                responseType: 'arraybuffer' // Ensure binary data is returned as Buffer
            });
            data = response.data;
        } catch (err) {
            // As the error data is binary here, we need to convert it to a string
            let message = 'Unknown error';
            if (err?.response?.data) {
                try {
                    message = Buffer.from(err.response.data).toString('utf8');
                } catch (decodeErr) {
                    message = 'Failed to decode error response.';
                }
            } else if (err?.message) {
                message = err.message;
            }
            throw new Error(`Failed to synthesize speech: ${message}`);
        }

        // For example: 1701980838697_elevenlabs_createSpeechSynthesis
        const filename = `${Date.now()}_${context.componentType.split('.')[1]}_${context.componentType.split('.')[3]}`;
        const file = await context.saveFileStream(filename, data); // data is a binary buffer

        return context.sendJson(file, 'out');
    }
};
