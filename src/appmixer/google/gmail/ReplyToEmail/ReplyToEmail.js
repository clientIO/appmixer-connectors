'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const emailCommons = require('../gmail-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some API functions for convenience
const gmail = GoogleApi.gmail('v1');
const send = Promise.promisify(gmail.users.messages.send, { context: gmail.users.messages });
const modify = Promise.promisify(gmail.users.messages.modify, { context: gmail.users.messages });
const getMessage = Promise.promisify(gmail.users.messages.get, { context: gmail.users.messages });

module.exports = {
    async receive(context) {
        const {
            email,
            from = context.profileInfo.email,
            sender,
            to,
            cc,
            bcc,
            text,
            html,
            signature,
            labels,
            attachments = {}
        } = context.messages.in.content;

        // Fetch email details using the email ID to get the thread ID
        const emailDetails = await getMessage({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            id: email
        });

        const threadId = emailDetails.threadId;
        const mail = {
            from: sender ? `${sender} <${from}>` : from,
            to,
            cc,
            bcc,
            subject: `Re: ${emailDetails.payload.headers.find(header => header.name === 'Subject').value}`, // Set the subject to be a reply
            text,
            html,
            attachments: await emailCommons.addAttachments(context, attachments),
            threadId: threadId,
            headers: {
                'In-Reply-To': emailDetails.payload.headers.find(header => header.name === 'Message-ID').value,
                'References': emailDetails.payload.headers.find(header => header.name === 'Message-ID').value
            }
        };

        emailCommons.addSignature(mail, signature);

        const emailContent = await emailCommons.buildEmail(mail);
        const result = await send({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            resource: {
                raw: emailContent.toString('base64').replace(/\+/gi, '-').replace(/\//gi, '_'),
                threadId: mail.threadId
            }
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
    }
};
