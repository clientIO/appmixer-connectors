'use strict';
const mailcomposer = require('mailcomposer');
const Promise = require('bluebird');
const mimelib = require('mimelib');

const BASE_URL = 'https://gmail.googleapis.com/gmail/v1';
function getGmailPartContent(part, _content) {

    // _content object is used to collect returned values during the recursive walk.
    _content = _content || {
        text: '',
        html: ''
    };

    // Note that there could be actual text/plain or text/html file attachments.
    // These parts, however, don't have the `body.data` object.
    if (part.body && part.body.data) {
        let contentType = (part.headers || []).find(h => {
            return h.name.toLowerCase() === 'content-type';
        });
        if (contentType) {
            let charset = mimelib.parseHeaderLine(contentType.value).charset;
            switch (part.mimeType.toLowerCase()) {
                case 'text/plain':
                    _content.text += mimelib.decodeBase64(part.body.data, charset);
                    break;
                case 'text/html':
                    _content.html += mimelib.decodeBase64(part.body.data, charset);
                    break;
            }
        }
    }

    (part.parts || []).forEach(nestedPart => {
        getGmailPartContent(nestedPart, _content);
    });

    return _content;
}

module.exports = {
    async callEndpoint(context, endpoint, {
        method,
        params = {},
        data = null,
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

        if (data) {
            options.data = data;
        }

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
    },

    getHeaderValue(headers, names) {
        for (let name of names) {
            const header = headers.find(header => header.name.toLowerCase() === name.toLowerCase());
            if (header) {
                return header.value;
            }
        }
        return null;
    },

    normalizeEmail(gmailMessageResource) {

        let email = {
            id: gmailMessageResource.id,
            threadId: gmailMessageResource.threadId,
            labelIds: gmailMessageResource.labelIds,
            snippet: gmailMessageResource.snippet,
            sizeEstimate: gmailMessageResource.sizeEstimate,
            payload: {
                date: new Date(parseInt(gmailMessageResource.internalDate, 10)),
                to: [],
                from: [],
                subject: '',
                text: '',
                html: ''
            }
        };

        const attachments =
            gmailMessageResource.payload.parts
                ?.filter((p) => !!p.body?.attachmentId)
                .map((p) => {
                    return {
                        id: p.body?.attachmentId,
                        size: p.body?.size,
                        filename: p.filename,
                        mimeType: p.mimeType
                    };
                }) || [];
        email.attachments = attachments;

        let gmailHeaders = gmailMessageResource.payload.headers || [];
        gmailHeaders.forEach(h => {
            switch (h.name.toLowerCase()) {
                case 'to':
                    email.payload.to = email.payload.to.concat(mimelib.parseAddresses(h.value));
                    break;
                case 'from':
                    email.payload.from = email.payload.from.concat(mimelib.parseAddresses(h.value));
                    break;
                case 'subject':
                    email.payload.subject = h.value;
                    break;
            }
        });

        // Recursively walk all the parts in the email and collect text and html content.
        let content = getGmailPartContent(gmailMessageResource.payload);
        email.payload.text = content.text;
        email.payload.html = content.html;

        return email;
    }
};
