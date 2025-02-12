'use strict';
const emailCommons = require('../lib');
const Promise = require('bluebird');

module.exports = {

    async tick(context) {

        const { download } = context.properties;
        const state = context.state;
        let query = context.properties.query;
        query = (query ? query + ' AND ' : '') + 'has:attachment';
        const { emails, state: newState } = await emailCommons.listNewMessages(context, query, state);

        // Fetch attachments from emails.
        const output = [];
        await Promise.map(emails, async (email) => {
            if (!email) {
                // Skip if the email was deleted.
                return;
            }
            if (!emailCommons.isNewInboxEmail(email.labelIds || [])) {
                // Skip SENT and DRAFT emails.
                return;
            }

            return Promise.map(email.attachments || [], async (attachment) => {
                const out = {
                    email,
                    attachment
                };
                if (download) {
                    const savedFile = await downloadAttachment(context, email.id, attachment.id, attachment.filename);
                    out.fileId = savedFile.fileId;
                    out.filename = savedFile.filename;
                    out.contentType = savedFile.contentType;
                }
                output.push(out);
            });
        });

        await context.sendArray(output, 'attachment');
        if (JSON.stringify(state != JSON.stringify(newState))) {
            return context.saveState(newState);
        }
    }
};

const downloadAttachment = async (context, emailId, attachmentId, filename) => {
    const response = await emailCommons.callEndpoint(context, `/users/me/messages/${emailId}/attachments/${attachmentId}`, {
        method: 'GET'
    });
    const base64 = response.data.data;
    const buffer = Buffer.from(base64, 'base64');
    const savedFile = await context.saveFileStream(filename, buffer);
    return savedFile;
};
