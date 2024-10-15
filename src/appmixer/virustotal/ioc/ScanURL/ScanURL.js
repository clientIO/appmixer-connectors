'use strict';

module.exports = {

    receive: async function(context) {

        const { url } = context.messages.in.content;
        const apiKey = context.auth.apiKey;

        let encodedUrl = Buffer.from(url).toString('base64');
        // Remove padding.
        encodedUrl = encodedUrl.replace(/\+/g, '-').replace(/\//g, '_').replace(/\=+$/, '');

        const endpoint = `https://www.virustotal.com/api/v3/urls/${encodedUrl}`;
        const { data } = await context.httpRequest.get(endpoint, {
            headers: {
                'x-apikey': apiKey
            }
        });

        await context.log({ step: 'response', data: JSON.stringify(data) });
        return context.sendJson(data, 'out');
    }
};
