/* eslint-disable camelcase */

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
        const { data } = await context.httpRequest({
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

        // For example: 1701980838697_elevenlabs_createSpeechSynthesis
        const filename = `${Date.now()}_${context.componentType.split('.')[1]}_${context.componentType.split('.')[3]}`;
        const file = await context.saveFileStream(filename, data); // data is a binary buffer

        return context.sendJson(file, 'out');
    }
};
