'use strict';

const { makeRequest } = require('../commons');

module.exports = {
    async receive(context) {

        const { messageId, attachmentId } = context.messages.in.content;

        const attachmentUrl = `/me/messages/${messageId}/attachments/${attachmentId}`;
        const attachmentResponse = await makeRequest(context, { path: attachmentUrl, method: 'GET' });

        const contentUrl = `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}/$value`;
        const attachmentContentResponse = await context.httpRequest({
            url: contentUrl,
            // Not sending accept header to get the raw data
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`
            },
            method: 'GET',
            responseType: 'arraybuffer'
        });

        const savedFile = await context.saveFileStream(attachmentResponse.data.name, attachmentContentResponse.data);
        return context.sendJson(savedFile, 'out');
    }
};
