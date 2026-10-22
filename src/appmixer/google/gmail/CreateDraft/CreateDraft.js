'use strict';
const emailCommons = require('../lib');

module.exports = {
    async receive(context) {
        if (!context.messages.in.content.subject) {
            throw new context.CancelError('Subject is required!');
        }

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
            attachments: await emailCommons.addAttachments(context, attachments)
        };

        emailCommons.addSignature(mail, signature);

        const emailContent = await emailCommons.buildEmail(mail);

        const result = await emailCommons.callEndpoint(context, '/users/me/drafts', {
            method: 'POST',
            data: {
                message: {
                    raw: emailContent.toString('base64').replace(/\+/gi, '-').replace(/\//gi, '_').replace(/=+$/, '')
                }
            }
        });

        if (labels?.AND?.some(label => label.name)) {
            await emailCommons.callEndpoint(context, `/users/me/messages/${result.data.message.id}/modify`, {
                method: 'POST',
                data: {
                    addLabelIds: labels.AND.filter(label => label.name).map(label => label.name)
                }
            });
        }

        return context.sendJson(result.data, 'draft');
    }
};
