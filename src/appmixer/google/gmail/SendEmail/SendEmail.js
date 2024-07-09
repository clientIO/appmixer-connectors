'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const mailcomposer = require('mailcomposer');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some API functions for convenience
const gmail = GoogleApi.gmail('v1');
const send = Promise.promisify(gmail.users.messages.send, { context: gmail.users.messages });
const modify = Promise.promisify(gmail.users.messages.modify, { context: gmail.users.messages });

/**
 * GMail send email component.
 * @extends {Component}
 */
module.exports = {
    async receive(context) {
        const {
            from = context.profileInfo.email,
            sender,
            to,
            cc,
            bcc,
            subject,
            text,
            html,
            signature,
            labels,
            attachments = {}
        } = context.messages.in.content;

        const mail = {
            from: sender ? `${sender} <${from}>` : from,
            to,
            cc,
            bcc,
            subject,
            text,
            html,
            attachments: await getAttachmentsContent(context, attachments)
        };

        // Add signature to the email content if provided
        if (signature) {
            if (mail.html) {
                mail.html += `<br><br>${signature}`;
            } else if (mail.text) {
                mail.html = `${mail.text.replace(/\n/g, '<br>')}<br><br>${signature}`;
                delete mail.text;
            } else {
                mail.html = signature;
            }
        }

        return new Promise((resolve, reject) => {
            const composer = mailcomposer(mail);
            composer.keepBcc = true;
            composer.build((err, email) => {
                if (err) {
                    return reject(err);
                }
                resolve(email);
            });
        }).then(async email => {
            const result = await send({
                auth: commons.getOauth2Client(context.auth),
                userId: 'me',
                quotaUser: context.auth.userId,
                resource: { raw: email.toString('base64').replace(/\+/gi, '-').replace(/\//gi, '_') }
            });

            if (labels && labels.AND && labels.AND.some(label => label.name)) {
                await modify({
                    auth: commons.getOauth2Client(context.auth),
                    userId: 'me',
                    id: result.id,
                    resource: {
                        addLabelIds: labels.AND.filter(label => label.name).map(label => label.name)
                    }
                });
            }

            return context.sendJson(result, 'email');
        });
    }
};

async function getAttachmentsContent(context, attachments) {
    const fileIds = (attachments.ADD || [])
    .map(attachment => attachment.fileId || null)
    .filter(fileId => fileId !== null);

    return await Promise.map(fileIds, async (fileId) => {
        const fileInfo = await context.getFileInfo(fileId);
        const fileStream = await context.getFileReadStream(fileId);
        return { filename: fileInfo.filename, content: fileStream };
    });
}
