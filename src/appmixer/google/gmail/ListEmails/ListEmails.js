'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const { promisify } = require('util');

// GoogleApi initialization & promisify of some API functions for convenience
const gmail = GoogleApi.gmail('v1');

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
        const listEmails = promisify(gmail.users.messages.list.bind(gmail.users.messages));
        const getMessage = promisify(gmail.users.messages.get.bind(gmail.users.messages));

        let emails = [];
        let nextPageToken = null;
        let totalEmails = 0;

        do {
            const result = await listEmails({
                auth: commons.getOauth2Client(context.auth),
                userId: 'me',
                quotaUser: context.auth.userId,
                pageToken: nextPageToken,
                maxResults: Math.min(pageSize, maxLimit - totalEmails)
            });

            if (result.messages) {
                for (const message of result.messages) {
                    if (variableFetch) {
                        const emailDetails = await getMessage({
                            auth: commons.getOauth2Client(context.auth),
                            userId: 'me',
                            id: message.id,
                            format: 'full'
                        });
                        emails.push(emailDetails);
                    } else {
                        emails.push({
                            id: message.id,
                            threadId: message.threadId
                        });
                    }
                }
            }

            totalEmails += result.messages ? result.messages.length : 0;
            nextPageToken = result.nextPageToken;
        } while (nextPageToken && totalEmails < maxLimit);

        if (outputType === 'emails') {
            return context.sendJson({ emails }, 'out');
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
            const filename = `gmail-listemails-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        }
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'email') {
            return context.sendJson(
                [
                    {
                        value: 'id',
                        label: 'Email ID'
                    },
                    {
                        value: 'threadId',
                        label: 'Email Thread ID'
                    }
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
                                    id: {
                                        type: 'string',
                                        title: 'Email ID'
                                    },
                                    threadId: {
                                        type: 'string',
                                        title: 'Email Thread ID'
                                    }
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
