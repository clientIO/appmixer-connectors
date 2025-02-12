'use strict';
const emailCommons = require('../lib');

module.exports = {

    async receive(context) {
        const { messageId, attachmentId, fileName } = context.messages.in.content;
        const endpoint = `/users/me/messages/${messageId}/attachments/${attachmentId}`;
        const attachment = await emailCommons.callEndpoint(context, endpoint, {
            headers: { 'Content-Type': 'application/json' }
        });

        const buffer = Buffer.from(attachment.data.data, 'base64');
        const name = fileName || `gmail-attachment-${messageId}-${attachmentId.substring(0, 20)}`;
        const file = await context.saveFileStream(name, buffer);
        return context.sendJson(file, 'out');
    }

};
