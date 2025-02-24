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
    async callEndpoint(context, endpoint, { method = 'GET', params = {}, data = null, headers = {}, responseType = 'json' } = {}) {
        const options = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                Authorization: `Bearer ${context.auth.accessToken}`,
                ...headers
            },
            params,
            responseType
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
            internalDate: gmailMessageResource.internalDate,
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
            const response = await this.callEndpoint(context, endpoint, { params });
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

    async listNewMessages(context, query, state) {

        const newState = {};
        let maxResults;

        if (state.lastMessageInternalDate) {
            // The size of the max results is not that important since
            // if not all messages are fetched, the next run will fetch them
            // (or the run before which the influx of emails stabilized).
            maxResults = 50;
            // Fetch only new messages that we haven't seen. Subtract 2 seconds to avoid
            // missing messages due to the internalDate resolution (the 'after' term only
            // accepts seconds while the internal date is in milliseconds).
            const internalDateSeconds = Math.floor(state.lastMessageInternalDate / 1000) - 2;
            query = (query ? query + ' AND ' : '') + 'after:' + internalDateSeconds;
        } else {
            maxResults = 1;
            await context.log({
                step: 'initialization',
                message: 'Fetching the latest message internal date from the inbox to be able to detect new incoming messages.',
                query
            });
            // During the initialization phase, we only need to get the latest message
            // regardless of whether it matches our query. Otherwise, we would always
            // miss the first email matching the query.
            query = '';
        }

        const endpoint = '/users/me/messages';
        const params = {
            maxResults,
            q: query
        };
        const response = await this.callEndpoint(context, endpoint, { params });
        let messages = response.data.messages || [];
        await context.log({
            step: 'query',
            query,
            messagesReturned: messages.length,
            lastMessageInternalDate: state.lastMessageInternalDate,
            lastMessageId: state.lastMessageId
        });

        if (state.lastMessageId) {
            // Get emails that we haven't seen. state.lastMessageId contains the ID of the last
            // message we have processed in the previous run.
            for (let i = 0; i < messages.length; i++) {
                if (messages[i].id === state.lastMessageId) {
                    messages = messages.slice(0, i);
                    break;
                }
            }
        }

        if (messages.length === 0) {
            // No new messages found.
            return { emails: [], state };
        }

        // Fetch the full email data for new messages.
        let emails = await Promise.map(messages, async (message) => {
            try {
                const response = await this.callEndpoint(context, `/users/me/messages/${message.id}`, {
                    method: 'GET',
                    params: { format: 'full' }
                });
                return this.normalizeEmail(response.data);
            } catch (err) {
                // email can be deleted (permanently) in gmail between listNewMessages call and
                // this getMessage call, in such case - ignore it and return null.
                if (err && err.response && err.response.status === 404) {
                    return null;
                }
                throw err;
            }
        }, { concurrency: 10 });

        // Update the state with the latest message ID.
        const lastMessage = emails[0];
        newState.lastMessageInternalDate = lastMessage.internalDate;
        newState.lastMessageId = lastMessage.id;

        await context.log({ step: 'emails-fetched', count: emails.length, lastMessage });

        if (!state.lastMessageId) {
            // Init phase. Just remember the last internalDate;
            await context.log({ step: 'initialized', lastMessage });
            return { emails: [], state: newState };
        }

        return { emails, state: newState };
    }
};
