'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const { promisify } = require('util');

// GoogleApi initialization & promisify of some api function for convenience
const gmail = GoogleApi.gmail('v1');

module.exports = {

    async receive(context) {

        const { messageId, attachmentId, fileName } = context.messages.in.content;
        const getAttachments = promisify(
            gmail.users.messages.attachments.get.bind(
                gmail.users.messages.attachments.get
            )
        );
        const attachment = await getAttachments({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            id: attachmentId,
            messageId
        });

        const buffer = Buffer.from(attachment.data, 'base64');
        const { fileId } = await context.saveFileStream(fileName, buffer);
        return context.sendJson({
            fileId
        }, 'out');
    }
};
