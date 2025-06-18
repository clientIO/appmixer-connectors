
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {        

        const { model_id, file, language_code, tag_audio_events, num_speakers, timestamps_granularity, diarize, additional_formats|file_format, additional_formats|file_extension, additional_formats|content_type, additional_formats|is_base64_encoded, additional_formats|content, cloud_storage_url, webhook, temperature } = context.messages.in.content;


        // https://elevenlabs.io/docs/api-reference/introduction
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.elevenlabs.io/v1/speech-to-text',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });
    

return context.sendJson(data, 'out');
    }
};
