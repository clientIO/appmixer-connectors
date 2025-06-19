/* eslint-disable camelcase */
'use strict';

module.exports = {
    async receive(context) {

        const { text, duration_seconds, prompt_influence, output_format } = context.messages.in.content;

        // https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
        let data;
        try {
            const response = await context.httpRequest({
                method: 'POST',
                url: 'https://api.elevenlabs.io/v1/sound-generation',
                headers: {
                    'xi-api-key': context.auth.apiKey
                },
                data: {
                    text,
                    duration_seconds,
                    prompt_influence,
                    output_format
                },
                responseType: 'arraybuffer'
            });
            data = response.data;
        } catch (err) {
            let message = 'Unknown error';
            if (err && err.response && err.response.data) {
                try {
                    message = Buffer.from(err.response.data).toString('utf8');
                } catch (decodeErr) {
                    message = 'Failed to decode error response.';
                }
            } else if (err && err.message) {
                message = err.message;
            }
            throw new Error(`Failed to generate sound effect: ${message}`);
        }

        const filename = `${Date.now()}_elevenlabs_soundeffect`;
        const file = await context.saveFileStream(filename, data);

        return context.sendJson(file, 'out');
    }
};
