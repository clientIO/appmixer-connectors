'use strict';
const emailCommons = require('../gmail-commons');

module.exports = {
    async receive(context) {
        const { messageId } = context.messages.in.content;
        const endpoint = `/users/me/messages/${messageId}`;
        const messageDetails = await emailCommons.callEndpoint(context, endpoint, {
            method: 'GET',
            params: {
                format: 'full'
            }
        });
        const normalizedEmail = emailCommons.normalizeEmail(messageDetails.data);

        const attachments = normalizedEmail.attachments.map(attachment => ({
            filename: attachment.filename,
            attachmentId: attachment.id
        }));

        return context.sendJson({ attachments }, 'out');
    },

    attachmentsToSelectArray({ attachments }) {
        return attachments.map(attachment => ({
            label: attachment.filename,
            value: attachment.attachmentId
        }));
    }
};
