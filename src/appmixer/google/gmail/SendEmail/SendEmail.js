'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const mailcomposer = require('mailcomposer');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const gmail = GoogleApi.gmail('v1');
const build = (mail) => {
    return new Promise((resolve, reject) => {
        mailcomposer(mail).build((err, email) => {
            if (err) {
                return reject(err);
            }
            resolve(email);
        });
    });
};
const send = Promise.promisify(gmail.users.messages.send, { context: gmail.users.messages });

/**
 * GMail send email component.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        /**
         * @type MailComposer
         */
        let mail = Object.assign({}, context.messages.in.content);
        if (mail.from && mail.sender) {
            mail.from = `${mail.sender} <${mail.from}>`;
        } else if (mail.sender) {
            mail.from = `${mail.sender} <${context.profileInfo.email}>`;
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

        const email = await build(mail);
        const result = await send({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            // URI-safe base64
            resource: { raw: email.toString('base64').replace(/\+/gi, '-').replace(/\//gi, '_') }
        });
        return context.sendJson(result, 'email');
    }
};
