'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { folderId, channelId, callbackUrl } = context.messages.in.content;

        // Create a watch channel for changes
        const watchRequest = {
            id: channelId || `googledocs-watch-${Date.now()}`,
            type: 'web_hook',
            address: callbackUrl
        };

        // https://developers.google.com/drive/api/v3/reference/changes/watch
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://www.googleapis.com/drive/v3/changes/watch',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: watchRequest,
            params: {
                pageToken: '1' // Start watching from now
            }
        });

        return context.sendJson({
            kind: data.kind,
            id: data.id,
            resourceId: data.resourceId,
            resourceUri: data.resourceUri
        }, 'out');
    }
};
