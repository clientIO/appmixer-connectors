'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {

        const { url, title, webhook, clientReferenceId, language } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('Media URL is required!');
        }

        // `uploadAudio` accepts an AudioUploadInput object. It also supports a
        // per-call `webhook` URL — the one place a Fireflies webhook can be set
        // programmatically (there is no webhook registration API otherwise).
        const query = `
            mutation UploadAudio($input: AudioUploadInput) {
                uploadAudio(input: $input) {
                    success
                    title
                    message
                }
            }
        `;

        const input = { url };
        if (title) input.title = title;
        if (webhook) input.webhook = webhook;
        if (clientReferenceId) input.client_reference_id = clientReferenceId;
        if (language) input.custom_language = language;

        const data = await lib.makeRequest({ context, query, variables: { input } });

        return context.sendJson((data && data.uploadAudio) || {}, 'out');
    }
};
