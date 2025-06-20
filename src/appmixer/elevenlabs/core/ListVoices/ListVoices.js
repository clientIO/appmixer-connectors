'use strict';

module.exports = {
    async receive(context) {

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.elevenlabs.io/v2/voices',
            headers: {
                'xi-api-key': context.auth.apiKey
            }
        });

        return context.sendJson({ voices: data.voices }, 'out');
    },

    voicesToSelectArray: function({ voices }) {
        return voices.map(voice => ({
            label: voice.name + ' (' + voice.category + ')',
            value: voice.voice_id
        }));
    }
};
