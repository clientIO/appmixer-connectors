'use strict';
const emailCommons = require('../gmail-commons');

module.exports = {
    async receive(context) {
        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { outputType, limit } = context.messages.in.content;
        const variableFetch = context.properties.variableFetch;
        const maxLimit = limit || 100;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const pageSize = 100; // Number of emails to retrieve per page
        let emails = [];
        let nextPageToken = null;
        let totalEmails = 0;

        do {
            const result = await emailCommons.callEndpoint(context, '/users/me/messages', {
                params: {
                    maxResults: Math.min(pageSize, maxLimit - totalEmails),
                    pageToken: nextPageToken
                },
                headers: { 'Content-Type': 'application/json' }
            });

            if (result.data.messages) {
                for (const message of result.data.messages) {
                    if (variableFetch) {
                        const messageDetails = await emailCommons.callEndpoint(context, `/users/me/messages/${message.id}`, {
                            params: {
                                format: 'full'
                            },
                            headers: { 'Content-Type': 'application/json' }
                        });
                        emails.push(messageDetails.data);
                    } else {
                        emails.push({
                            id: message.id,
                            threadId: message.threadId
                        });
                    }
                }
            }

            totalEmails += result.data.messages ? result.data.messages.length : 0;
            nextPageToken = result.data.nextPageToken;
        } while (nextPageToken && totalEmails < maxLimit);

        if (outputType === 'first') {
            return context.sendJson(emails[0], 'out');
        }
        if (outputType === 'emails') {
            return context.sendJson({ emails }, 'out');
        }

        if (outputType === 'email') {
            await context.sendArray(emails, 'out');
        }

        if (outputType === 'file') {
            const headers = Object.keys(emails[0]);
            const csvRows = [headers.join(',')];

            for (const email of emails) {
                const row = Object.values(email).join(',');
                csvRows.push(row);
            }

            const csvString = csvRows.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const filename = `gmail-listemails-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        }
    },

    getOutputPortOptions(context, outputType) {
        if (outputType === 'first') {
            return context.sendJson(
                [
                    { value: 'id', label: 'Email Message ID' },
                    { value: 'threadId', label: 'Thread ID' }
                ],
                'out'
            );
        } else if (outputType === 'email') {
            return context.sendJson(
                [
                    { value: 'id', label: 'Email Message ID' },
                    { value: 'threadId', label: 'Thread ID' }
                ],
                'out'
            );
        } else if (outputType === 'emails') {
            return context.sendJson(
                [
                    {
                        label: 'Emails',
                        value: 'emails',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', title: 'Email Message ID' },
                                    threadId: { type: 'string', title: 'Thread ID' }
                                }
                            }
                        }
                    }
                ],
                'out'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    },

    emailsToSelectArray({ emails }) {
        return emails.map(mail => {
            return { label: `${mail.snippet}`, value: `${mail.id}` };
        });
    }
};
