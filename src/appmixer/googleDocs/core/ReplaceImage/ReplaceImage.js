'use strict';

module.exports = {
    async receive(context) {

        const { documentId, targetImageId, newImageUrl } = context.messages.in.content;

        const requests = [{
            replaceImage: {
                imageObjectId: targetImageId,
                uri: newImageUrl
            }
        }];

        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: { requests }
        });

        return context.sendJson(data, 'out');
    }
};
