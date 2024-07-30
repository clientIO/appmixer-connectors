'use strict';
const emailCommons = require('../gmail-commons');

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
            attachments: await emailCommons.addAttachments(context, attachments)
        };

        emailCommons.addSignature(mail, signature);

        const email = await emailCommons.buildEmail(mail);

        const result = await emailCommons.callEndpoint(context, '/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                raw: email.toString('base64').replace(/\+/gi, '-').replace(/\//gi, '_').replace(/=+$/, '')
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

        return context.sendJson(result.data, 'email');
    }
};
