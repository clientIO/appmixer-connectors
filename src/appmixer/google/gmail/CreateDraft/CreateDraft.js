'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');
const mailcomposer = require('mailcomposer');

// GoogleApi initialization & promisify of some API functions for convenience
const gmail = GoogleApi.gmail('v1');
const createDraft = Promise.promisify(gmail.users.drafts.create, { context: gmail.users.drafts });
const modify = Promise.promisify(gmail.users.messages.modify, { context: gmail.users.messages });

module.exports = {

    async receive(context) {

        /**
         * @type MailComposer
         */
        let mail = context.messages.in.content;
        if (mail.from && mail.sender) {
            mail.from = `${mail.sender} <${mail.from}>`;
        } else if (mail.sender) {
            mail.from = `${mail.sender} <${context.profileInfo.email}>`;
        }

        if (context.messages.in.content.cc) {
            mail.cc = context.messages.in.content.cc;
        }

        if (context.messages.in.content.bcc) {
            mail.bcc = context.messages.in.content.bcc;
        }

        const { attachments = {} } = context.messages.in.content;
        const fileIds = (attachments.ADD || [])
            .map(attachment => (attachment.fileId || null))
            .filter(fileId => fileId !== null);

        mail.attachments = await Promise.map(fileIds, async (fileId) => {
            const fileInfo = await context.getFileInfo(fileId);
            const fileStream = await context.getFileReadStream(fileId);
            return { filename: fileInfo.filename, content: fileStream };
        });

        // Add signature to the email content if provided
        if (context.messages.in.content.signature) {
            if (mail.html) {
                mail.html += `<br><br>${context.messages.in.content.signature}`;
            } else if (mail.text) {
                mail.html = `${mail.text.replace(/\n/g, '<br>')}<br><br>${context.messages.in.content.signature}`;
                delete mail.text;
            } else {
                mail.html = context.messages.in.content.signature;
            }
        }

        return new Promise((resolve, reject) => {
            mailcomposer({ ...mail, keepBcc: true }).build((err, email) => {
                if (err) {
                    return reject(err);
                }
                resolve(email);
            });
        }).then(async email => {
            const result = await createDraft({
                auth: commons.getOauth2Client(context.auth),
                userId: 'me',
                quotaUser: context.auth.userId,
                resource: {
                    message: {
                        // URI-safe base64
                        raw: email.toString('base64').replace(/\+/gi, '-').replace(/\//gi, '_')
                    }
                }
            });

            // Add labels to the draft
            if (context.messages.in.content.labels && result.id) {
                await modify({
                    auth: commons.getOauth2Client(context.auth),
                    userId: 'me',
                    id: result.message.id,
                    resource: {
                        addLabelIds: context.messages.in.content.labels.AND.map(label => label.name)
                    }
                });
            }

            return context.sendJson(result, 'draft');
        });
    }
};
