'use strict';
const emailCommons = require('../gmail-commons');

module.exports = {

    async receive(context) {
        const { messageId, attachmentId, fileName } = context.messages.in.content;
        const endpoint = `/users/me/messages/${messageId}/attachments/${attachmentId}`;
        const attachment = await emailCommons.callEndpoint(context, endpoint, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const buffer = Buffer.from(attachment.data.data, 'base64');
        const { fileId } = await context.saveFileStream(fileName, buffer);
        return context.sendJson({ fileId }, 'out');
    }

};
