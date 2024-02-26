'use strict';
const GoogleApi = require('googleapis');
const mimelib = require('mimelib');
const Promise = require('bluebird');
const parseEmail = Promise.promisify(require('parse-gmail-email'));
const gmail = GoogleApi.gmail('v1');
const list = Promise.promisify(gmail.users.messages.list, { context: gmail.users.messages });
const { OAuth2Client } = require('google-auth-library');
const pathModule = require('path');

/**
 * Recursively collect text/plain and text/html content, ignoring attachments.
 * @param {object} part -  MessagePart as described here https://developers.google.com/gmail/api/v1/reference/users/messages#resource.
 * @param {*} _content
 * @returns {object} - returns an object of the form { text: String, html: String }.
 */
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

    get GoogleApi() {

        return GoogleApi;
    },

    ERROR_MAP: {
        'Invalid query parameter value for grid_id.': 'Invalid worksheet id! '
            + 'Possible solution, stop the flow, select valid existing worksheet in NewRow component, start flow again.'
    },

    getOauth2Client(auth) {

        let { clientId, clientSecret, callback, accessToken } = auth;
        let OAuth2 = GoogleApi.auth.OAuth2;
        let oauth2Client = new OAuth2(clientId, clientSecret, callback);

        oauth2Client.credentials = {
            'access_token': accessToken
        };

        return oauth2Client;
    },

    /**
     * This returns the object used by the newest API SDK versions
     * @param auth
     * @returns {*}
     */
    getAuthLibraryOAuth2Client(auth) {

        const { clientId, clientSecret, callback, accessToken } = auth;

        const oAuth2Client = new OAuth2Client(clientId, clientSecret, callback);

        oAuth2Client.setCredentials({
            'access_token': accessToken
        });

        return oAuth2Client;
    },

    get parseEmail() {

        return parseEmail;
    },

    /**
     * Function compares two hexadecimal numbers (used as ID in gmail messages), this
     * function can be used for Array.prototype.sort() method.
     * Use Array.prototype.sort(commons.compareIds(a, b)) for ASC and
     * Array.prototype.sort(commons.compareIds(a, b)) for DESC.
     * @param {string} a - hexadecimal number
     * @param {string} b - hexadecimal number
     * @returns {number} - returns -1 if a < b, 1, if a > b and 0 if numbers are equal
     */
    compareIds(a, b) {

        let ax = parseInt(a, 16);
        if (isNaN(ax)) {
            throw new Error('First value: ' + a + ' is not a hexadecimal number');
        }

        let bx = parseInt(b, 16);
        if (isNaN(bx)) {
            throw new Error('Second value ' + b + ' is not a hexadecimal number');
        }

        if (ax < bx) {
            return -1;
        }
        if (ax > bx) {
            return 1;
        }

        return 0;
    },

    /**
     * Convert Gmail message response format to our own email format (similar to what MailParser uses).
     * @see https://developers.google.com/gmail/api/v1/reference/users/messages#resource and https://github.com/andris9/mailparser#parsed-mail-object.
     * @param {object} gmailMessageResource -  MessageResource as described here https://developers.google.com/gmail/api/v1/reference/users/messages#resource.
     * @returns {object} - returns an object representing our own email format.
     */
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
    },

    /**
     * Recursively call google list messages until all new messages are found (their IDs).
     * @param {Object} options - options for google API messages.list call
     * @param {Object} options.auth - checkout google doc
     * @param {string} options.userId - checkout google doc
     * @param {string} options.quotaUser - checkout google doc
     * @param {number} [options.maxResults] - how many messages per page (request)
     * @param {string} [lastMessageId] - if not given function will return object with
     *   the lastMessageId set to the last message in mailbox and newMessages will be an
     *   empty array
     * @param {Object} [result] - for recursion
     * @param {number|null} [limit] - maximum of new email IDs
     * @return {Object} {
     *    lastMessageId:
     *    newMessages:
     * }
     */
    listNewMessages(options, lastMessageId, result = {}, limit = null) {

        // get 300 messages per each call
        options.maxResults = options.maxResults || 300;
        return list(options)
            .then(response => {
                if (!lastMessageId) {
                    return {
                        lastMessageId: response.messages[0].id || null,
                        newMessages: []
                    };
                }
                if (!result.hasOwnProperty('lastMessageId')) {
                    result.lastMessageId = response.messages[0].id || undefined;
                }
                if (!result.hasOwnProperty('newMessages')) {
                    result.newMessages = [];
                }

                let diff = this.getNewMessages(lastMessageId, response.messages);
                result.newMessages = result.newMessages.concat(diff);

                if (limit && result.newMessages.length >= limit) {
                    return result;
                }

                // all messages are new, probably there's more new messages on the next page
                if (diff.length === response.messages.length && response.nextPageToken) {
                    return this.listNewMessages(
                        Object.assign(options, { pageToken: response.nextPageToken }),
                        lastMessageId,
                        result,
                        limit
                    );
                }

                return result;
            });
    },

    /**
     * This is used in NewEmail and NewAttachment component to compare email(message)
     * ids and return list of new emails(messages).
     * @param {string} latestMessageId
     * @param {Array} messages
     * @return {Array}
     */
    getNewMessages(latestMessageId, messages) {

        let differences = [];

        messages.sort((a, b) => {
            // sort the messages according to id DESC. It should already be sorted that
            // way, but docs does not say anything about it so just to be sure
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
    },

    /**
     * Return true when email is new email. It skips plain SENT and DRAFT messages - messages with
     * only one label and SENT or DRAFT being that label.
     * @param {Array} labelIds
     * @return {boolean}
     * @throws Error
     */
    isNewInboxEmail(labelIds) {

        if (!Array.isArray(labelIds)) {
            throw new Error('Invalid label IDs array.');
        }

        return labelIds.length !== 1 || (labelIds.indexOf('SENT') === -1 && labelIds.indexOf('DRAFT') === -1);
    },

    /**
     * Get recursively all message IDs based on options.
     * @param {Object} options
     * @param {Object} options.auth - checkout google doc
     * @param {string} options.userId - checkout google doc
     * @param {string} options.quotaUser - checkout google doc
     * @param {number} [options.maxResults] - how many messages per page (request)
     * @param {Array} [options.labelIds]
     * @param result
     * @return {Array} [{
     *    id,
     *    threadId
     * }]
     */
    getAllMessageIds(options, result = []) {

        options.maxResults = options.maxResults || 300;
        return list(options)
            .then(response => {
                if (!response.messages) {
                    return result;
                }
                result = result.concat(response.messages);
                if (response.nextPageToken) {
                    return this.getAllMessageIds(
                        Object.assign(options, { pageToken: response.nextPageToken }),
                        result
                    );
                }
                return result;
            });
    },

    /**
     * Convert google's date|dateTime object into Date.
     * @param {Object} dateObject - containing either date or dateTime
     * @return {Date|*}
     */
    formatDate(dateObject) {

        if (!dateObject) {
            return dateObject;
        }
        return new Date(dateObject.date ? dateObject.date : dateObject.dateTime);
    },

    // TODO: Move to appmixer-lib
    // Expects standardized outputType: 'item', 'items', 'file'
    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'items', records = [] }) {
        if (outputType === 'item') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'items') {
            // All at once.
            await context.sendJson({ items: records }, outputPortName);
        } else if (outputType === 'file') {
            // Into CSV file.
            const csvString = toCsv(records);

            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'google-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    }
};

// TODO: Move to appmixer-lib
const toCsv = (array) => {
    const headers = Object.keys(array[0]);

    return [
        headers.join(','),

        ...array.map(items => {
            return Object.values(items).map(property => {
                if (typeof property === 'object') {
                    property = JSON.stringify(property);
                    // Make stringified JSON valid CSV value.
                    property = property.replace(/"/g, '""');
                }
                return `"${property}"`;
            }).join(',');
        })

    ].join('\n');
}
