
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { folderId, channelId, callbackUrl } = context.messages.in.content;

        // https://developers.google.com/drive/api/v3/reference/changes/watch
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://www.googleapis.com/drive/v3/changes/watch',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
