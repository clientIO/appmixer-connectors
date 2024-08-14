'use strict';
const mailcomposer = require('mailcomposer');
const Promise = require('bluebird');
const mimelib = require('mimelib');

const BASE_URL = 'https://gmail.googleapis.com/gmail/v1';

function getGmailPartContent(part, _content) {
    _content = _content || { text: '', html: '' };

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
    async callEndpoint(context, endpoint, { method, params = {}, data = null, headers = {} } = {}) {
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

        let content = getGmailPartContent(gmailMessageResource.payload);
        email.payload.text = content.text;
        email.payload.html = content.html;

        return email;
    },

    async getAllMessageIds({ context, userId, maxResults = 300, pageToken = null }) {
        let allMessages = [];
        let endpoint = `/users/${userId}/messages`;

        do {
            const params = {
                maxResults,
                pageToken
            };
            const response = await this.callEndpoint(context, endpoint, { method: 'GET', params });
            const messages = response.data.messages || [];
            allMessages = allMessages.concat(messages);
            pageToken = response.data.nextPageToken;

        } while (pageToken);

        return allMessages;
    },

    compareIds(a, b) {
        let ax = parseInt(a, 16);
        let bx = parseInt(b, 16);

        if (ax < bx) return -1;
        if (ax > bx) return 1;
        return 0;
    },

    isNewInboxEmail(labelIds) {
        if (!Array.isArray(labelIds)) {
            throw new Error('Invalid label IDs array.');
        }

        return labelIds.length !== 1 || (labelIds.indexOf('SENT') === -1 && labelIds.indexOf('DRAFT') === -1);
    },

    async listNewMessages(options, lastMessageId, result = {}, limit = null) {
        const maxResults = options.maxResults || 300;
        const endpoint = `/users/${options.userId}/messages`;

        do {
            const response = await this.callEndpoint(options.context, endpoint, {
                method: 'GET',
                params: {
                    maxResults,
                    pageToken: options.pageToken || ''
                }
            });

            if (!lastMessageId) {
                return {
                    lastMessageId: response.data.messages ? response.data.messages[0].id : null,
                    newMessages: []
                };
            }

            if (!result.hasOwnProperty('lastMessageId')) {
                result.lastMessageId = response.data.messages ? response.data.messages[0].id : undefined;
            }

            if (!result.hasOwnProperty('newMessages')) {
                result.newMessages = [];
            }

            const diff = this.getNewMessages(lastMessageId, response.data.messages || []);
            result.newMessages = result.newMessages.concat(diff);

            if (limit && result.newMessages.length >= limit) {
                return result;
            }

            options.pageToken = response.data.nextPageToken;
        } while (options.pageToken);

        return result;
    },

    getNewMessages(latestMessageId, messages) {
        let differences = [];

        messages.sort((a, b) => {
            return -this.compareIds(a.id, b.id);
        });

        for (let i = 0; i < messages.length; i++) {
            let message = messages[i];
            if (this.compareIds(message.id, latestMessageId) === 1) {
                differences.push(message);
            } else {
                return differences;
            }
        }

        return differences;
    }
};
