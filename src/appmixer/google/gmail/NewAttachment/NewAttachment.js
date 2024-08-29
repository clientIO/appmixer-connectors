'use strict';
const emailCommons = require('../gmail-commons');
const Promise = require('bluebird');

module.exports = {
    async tick(context) {
        let newState = {};

        const { labels: { AND: labels } = { AND: [] } } = context.properties;
        const isLabelsEmpty = !labels.some(label => label.name);

        // Fetch new messages from the inbox
        const data = await emailCommons.listNewMessages(
            { context, userId: 'me' },
            context.state.id || null
        );

        // Update the state with the latest message ID
        newState.id = data.lastMessageId;

        // Fetch the full email data for new messages
        const emails = await Promise.map(data.newMessages, async message => {
            return emailCommons.callEndpoint(context, `/users/me/messages/${message.id}`, {
                method: 'GET',
                params: { format: 'full' }
            }).then(response => response.data).catch(err => {
                // email can be deleted (permanently) in gmail between listNewMessages call and
                // this getMessage call, in such case - ignore it and return null
                if (err && err.response && err.response.status === 404) {
                    return null;
                }
                throw err;
            });
        }, { concurrency: 10 });

        // Extract attachments from emails
        let attachments = await Promise.map(emails, email => {
            if (!email || !email.labelIds) {
                // Skip if the email was deleted or labelIds is missing
                return [];
            }

            // Filter emails based on selected labels
            if (isLabelsEmpty || labels.some(label => email.labelIds.includes(label.name))) {
                return downloadAttachments(context, email);
            }
            return [];
        });

        // Flatten the array of attachments
        attachments = attachments.reduce((a, b) => a.concat(b), []);

        // Save attachments and send them to the output port
        let saved = await Promise.map(attachments, attachment => {
            const buffer = Buffer.from(attachment.data, 'base64');
            return context.saveFileStream(
                attachment.filename,
                buffer
            ).then(res => {
                return Object.assign(res, { subject: attachment.subject });
            });
        });

        await Promise.map(saved, savedFile => {
            return context.sendJson(savedFile, 'attachment');
        });

        await context.saveState(newState);
    }
};

/**
 * Download attachments from an email.
 * @param {Context} context
 * @param {Object} email
 * @return {Array<Object>} returns array with attachments
 */
let downloadAttachments = async (context, email) => {
    if (!emailCommons.isNewInboxEmail(email.labelIds)) {
        return []; // skip SENT and DRAFT emails
    }

    // Parse the email content to extract attachments
    const parsedEmail = emailCommons.normalizeEmail(email);

    return Promise.map(parsedEmail.attachments || [], attachment => {
        return emailCommons.callEndpoint(context, `/users/me/messages/${email.id}/attachments/${attachment.id}`, {
            method: 'GET'
        }).then(response => {
            return {
                filename: attachment.filename,
                mimetype: attachment.mimeType || 'application/octet-stream', // Ensure mimetype is set
                size: attachment.size,
                data: response.data.data,
                subject: parsedEmail.payload.subject
            };
        });
    });
};
