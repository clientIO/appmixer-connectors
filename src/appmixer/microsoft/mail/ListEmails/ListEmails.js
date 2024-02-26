'use strict';

const { makeRequest } = require('../commons');

const PAGE_SIZE = 100;

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.outputType);
        }

        const { outputType, limit } = context.messages.in.content;
        const MAX_LIMIT = limit || 100;
        let totalEmails = 0;
        let emails = [];
        let nextLink = null;
        do {
            const { data: result } = await makeRequest(context, {
                path: '/me/messages',
                method: 'GET',
                params: {
                    top: Math.min(PAGE_SIZE, MAX_LIMIT - totalEmails),
                    nextLink
                }
            });
            emails = emails.concat(result.value);
            nextLink = result['@odata.nextLink'];
            totalEmails += result.value.length;
        } while (nextLink && totalEmails < MAX_LIMIT);

        if (outputType === 'emails') {
            await context.sendJson({ emails }, 'out');
        }
        const headers = Object.keys(emails[0]);
        const csvRows = [headers.join(',')];

        for (const email of emails) {
            if (outputType === 'email') {
                await context.sendJson(email, 'out');
            } else {
                const row = Object.values(email).join(',');
                csvRows.push(row);
            }
        }

        if (outputType === 'file') {
            const csvString = csvRows.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const filename = `microsoft-mail-listemails-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        }
    },
    getOutputPortOptions(context, outputType) {

        if (outputType === 'email') {
            return context.sendJson([
                {
                    label: 'Odata Etag',
                    value: '@odata.etag'
                },
                {
                    label: 'Id',
                    value: 'id'
                },
                {
                    label: 'Created Date Time',
                    value: 'createdDateTime'
                },
                {
                    label: 'Last Modified Date Time',
                    value: 'lastModifiedDateTime'
                },
                {
                    label: 'Change Key',
                    value: 'changeKey'
                },
                {
                    label: 'Categories',
                    value: 'categories'
                },
                {
                    label: 'Received Date Time',
                    value: 'receivedDateTime'
                },
                {
                    label: 'Sent Date Time',
                    value: 'sentDateTime'
                },
                {
                    label: 'Has Attachments',
                    value: 'hasAttachments'
                },
                {
                    label: 'Internet Message Id',
                    value: 'internetMessageId'
                },
                {
                    label: 'Subject',
                    value: 'subject'
                },
                {
                    label: 'Body Preview',
                    value: 'bodyPreview'
                },
                {
                    label: 'Importance',
                    value: 'importance'
                },
                {
                    label: 'Parent Folder Id',
                    value: 'parentFolderId'
                },
                {
                    label: 'Conversation Id',
                    value: 'conversationId'
                },
                {
                    label: 'Conversation Index',
                    value: 'conversationIndex'
                },
                {
                    label: 'Is Delivery Receipt Requested',
                    value: 'isDeliveryReceiptRequested'
                },
                {
                    label: 'Is Read Receipt Requested',
                    value: 'isReadReceiptRequested'
                },
                {
                    label: 'Is Read',
                    value: 'isRead'
                },
                {
                    label: 'Is Draft',
                    value: 'isDraft'
                },
                {
                    label: 'Web Link',
                    value: 'webLink'
                },
                {
                    label: 'Inference Classification',
                    value: 'inferenceClassification'
                },
                {
                    label: 'Body Content Type',
                    value: 'body.contentType'
                },
                {
                    label: 'Body Content',
                    value: 'body.content'
                },
                {
                    label: 'To Recipients',
                    value: 'toRecipients'
                },
                {
                    label: 'Cc Recipients',
                    value: 'ccRecipients'
                },
                {
                    label: 'Bcc Recipients',
                    value: 'bccRecipients'
                },
                {
                    label: 'Reply To',
                    value: 'replyTo'
                },
                {
                    label: 'Flag Flag Status',
                    value: 'flag.flagStatus'
                }
            ], 'out');
        } else if (outputType === 'emails') {
            return context.sendJson([{ label: 'Emails', value: 'emails' }], 'out');
        } else {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};

