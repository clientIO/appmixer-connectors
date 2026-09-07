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
                output.push(await buildOutput(context, email, attachment, download));
            });
        });

        await context.sendArray(output, 'attachment');
        if (JSON.stringify(state != JSON.stringify(newState))) {
            return context.saveState(newState);
        }
    },

    // Flow Test Mode: emit one realistic attachment without starting the flow. Builds the same
    // query as tick() (user query + has:attachment), honors the inbox filter and the download
    // property, and shapes the output through the same buildOutput() helper.
    async test(context) {

        const { download } = context.properties;
        let query = context.properties.query;
        query = (query ? query + ' AND ' : '') + 'has:attachment';

        const email = await emailCommons.fetchLatestExample(context, query);
        if (!email || !(email.attachments || []).length) {
            throw new Error('No recent emails with attachments matching the query to use as test data.');
        }
        if (!emailCommons.isNewInboxEmail(email.labelIds || [])) {
            throw new Error('The most recent matching email is a SENT or DRAFT email.');
        }

        const out = await buildOutput(context, email, email.attachments[0], download);
        return context.sendJson(out, 'attachment');
    }
};

// Build one output record ({ email, attachment, [fileId, filename, contentType] }).
// Shared by tick() and test() so the output shape lives in one place.
const buildOutput = async (context, email, attachment, download) => {
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
    return out;
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
