'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const emailCommons = require('../gmail-commons');
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
            attachments: await emailCommons.addAttachments(context, attachments)
        };

        emailCommons.addSignature(mail, signature);

        const email = await emailCommons.buildEmail(mail);

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
    }
};
