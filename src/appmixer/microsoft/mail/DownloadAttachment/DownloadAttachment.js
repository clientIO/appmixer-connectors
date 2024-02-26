'use strict';

const { makeRequest } = require('../commons');

module.exports = {
    async receive(context) {

        const { messageId, attachmentId } = context.messages.in.content;

        const attachmentUrl = `/me/messages/${messageId}/attachments/${attachmentId}`;
        const attachmentResponse = await makeRequest(context, { path: attachmentUrl, method: 'GET' });

        const contentUrl = `/me/messages/${messageId}/attachments/${attachmentId}/$value`;
        const attachmentContentResponse = await makeRequest(context, {
            path: contentUrl,
            method: 'GET',
            responseType: 'arraybuffer'
        });

        const savedFile = await context.saveFileStream(attachmentResponse.data.name, attachmentContentResponse.data);
        return context.sendJson(savedFile, 'out');
    }
};
