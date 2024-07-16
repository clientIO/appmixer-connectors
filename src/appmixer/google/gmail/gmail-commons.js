'use strict';
const mailcomposer = require('mailcomposer');
const Promise = require('bluebird');

const BASE_URL = 'https://gmail.googleapis.com/gmail/v1';

module.exports = {
    async fetchData(context, endpoint, {
        method = 'GET',
        params = {},
        headers = {}
    } = {}) {
        const options = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                Authorization: `Bearer ${context.auth.accessToken}`,
                ...headers
            },
            params
        };

        return await context.httpRequest(options);
    },

    async addAttachments(context, attachments) {
        const fileIds = (attachments.ADD || [])
            .map(attachment => attachment.fileId || null)
            .filter(fileId => fileId !== null);

        return await Promise.map(fileIds, async (fileId) => {
            const fileInfo = await context.getFileInfo(fileId);
            const fileStream = await context.getFileReadStream(fileId);
            return { filename: fileInfo.filename, content: fileStream };
        });
    },

    addSignature(mail, signature) {
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
    },

    async buildEmail(mail) {
        return new Promise((resolve, reject) => {
            const mailOptions = { ...mail };
            const composer = mailcomposer(mailOptions);
            composer.keepBcc = true;
            composer.build((err, email) => {
                if (err) {
                    return reject(err);
                }
                resolve(email);
            });
        });
    }
};
