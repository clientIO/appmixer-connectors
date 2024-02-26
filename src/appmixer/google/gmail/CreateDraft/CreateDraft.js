'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');
const mailcomposer = require('mailcomposer');

// GoogleApi initialization & promisify of some api function for convenience
const gmail = GoogleApi.gmail('v1');
const createDraft = Promise.promisify(gmail.users.drafts.create, { context: gmail.users.drafts });

module.exports = {

    receive(context) {

        /**
         * @type MailComposer
         */
        let mail = context.messages.in.content;
        if (mail.from && mail.sender) {
            mail.from = `${mail.sender} <${mail.from}>`;
        } else if (mail.sender) {
            mail.from = `${mail.sender} <${context.profileInfo.email}>`;
        }

        return new Promise((resolve, reject) => {
            mailcomposer(mail).build((err, email) => {
                if (err) {
                    return reject(err);
                }
                resolve(email);
            });
        }).then(email => {
            return createDraft({
                auth: commons.getOauth2Client(context.auth),
                userId: 'me',
                quotaUser: context.auth.userId,
                resource: {
                    message: {
                        // URI-safe base64
                        raw: email.toString('base64').replace(/\+/gi, '-').replace(/\//gi, '_')
                    }
                }
            }).then(result => {
                return context.sendJson(result, 'draft');
            });
        });
    }
};
