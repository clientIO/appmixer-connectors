'use strict';
const emailCommons = require('../gmail-commons');

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
        const emailDetails = await emailCommons.callEndpoint(context, `/users/me/messages/${email}`, {
            method: 'GET'
        });
        const subject = emailCommons.getHeaderValue(emailDetails.data.payload.headers, ['Subject']);
        const messageId = emailCommons.getHeaderValue(emailDetails.data.payload.headers, ['Message-ID', 'Message-Id']);

        const mainSubject = subject;
        const references = messageId;
        const threadId = emailDetails.data.threadId;

        const mail = {
            from: sender ? `${sender} <${from}>` : from,
            to,
            cc,
            bcc,
            subject: mainSubject,
            text,
            html,
            attachments: await emailCommons.addAttachments(context, attachments),
            threadId: threadId,
            headers: {
                'In-Reply-To': references,
                'References': references
            }
        };

        emailCommons.addSignature(mail, signature);

        const emailContent = await emailCommons.buildEmail(mail);

        const result = await emailCommons.callEndpoint(context, '/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                raw: emailContent.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
                threadId: mail.threadId
            }
        });

        if (labels && labels.AND && labels.AND.some(label => label.name)) {
            await emailCommons.callEndpoint(context, `/users/me/messages/${result.data.id}/modify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    addLabelIds: labels.AND.filter(label => label.name).map(label => label.name)
                }
            });
        }

        return context.sendJson(result.data, 'out');
    }
};
