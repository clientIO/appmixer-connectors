'use strict';

const { makeRequest } = require('../commons');

const PAGE_SIZE = 50;

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.outputType);
        }

        const { teamId, channelId, outputType, limit } = context.messages.in.content;
        const MAX_LIMIT = limit || 50;
        let totalMessages = 0;
        let messages = [];
        let nextLink = null;

        do {
            const { data: response } = await makeRequest(context, {
                path: `/teams/${teamId}/channels/${channelId}/messages`,
                method: 'GET',
                params: {
                    top: Math.min(PAGE_SIZE, MAX_LIMIT - totalMessages),
                    nextLink
                }
            });

            if (!response.value.length) {
                break;
            }

            messages = messages.concat(response.value);
            nextLink = response['@odata.nextLink'];
            totalMessages += response.value.length;
        } while (nextLink && totalMessages < MAX_LIMIT);

        if (outputType === 'items') {
            await context.sendJson({ messages }, 'out');
        }

        const headers = Object.keys(messages[0] || {});
        const csvRowsArray = [headers.join(',')];

        for (const message of messages) {
            if (outputType === 'item') {
                await context.sendJson(message, 'out');
            } else {
                const row = Object.values(message).join(',');
                csvRowsArray.push(row);
            }
        }

        if (outputType === 'file') {
            const csvString = csvRowsArray.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const filename = `microsoft-teams-ListChannelMessages-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        }
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson([
                {
                    label: 'Id',
                    value: 'id'
                },
                {
                    label: 'Reply To Id',
                    value: 'replyToId'
                },
                {
                    label: 'Etag',
                    value: 'etag'
                },
                {
                    label: 'Message Type',
                    value: 'messageType'
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
                    label: 'Last Edited Date Time',
                    value: 'lastEditedDateTime'
                },
                {
                    label: 'Deleted Date Time',
                    value: 'deletedDateTime'
                },
                {
                    label: 'Subject',
                    value: 'subject'
                },
                {
                    label: 'Summary',
                    value: 'summary'
                },
                {
                    label: 'Chat Id',
                    value: 'chatId'
                },
                {
                    label: 'Importance',
                    value: 'importance'
                },
                {
                    label: 'Locale',
                    value: 'locale'
                },
                {
                    label: 'Web Url',
                    value: 'webUrl'
                },
                {
                    label: 'Policy Violation',
                    value: 'policyViolation'
                },
                {
                    label: 'Event Detail',
                    value: 'eventDetail'
                },
                {
                    label: 'From',
                    value: 'from'
                },
                {
                    label: 'Body',
                    value: 'body'
                },
                {
                    label: 'Channel Identity',
                    value: 'channelIdentity'
                },
                {
                    label: 'Attachments',
                    value: 'attachments'
                },
                {
                    label: 'Mentions',
                    value: 'mentions'
                },
                {
                    label: 'Reactions',
                    value: 'reactions'
                },
                {
                    label: 'Message History',
                    value: 'messageHistory'
                }
            ], 'out');
        } else if (outputType === 'items') {
            return context.sendJson([{ label: 'Messages', value: 'messages', schema: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            title: 'Id'
                        },
                        replyToId: {
                            type: 'string',
                            title: 'Reply To Id'
                        },
                        etag: {
                            type: 'string',
                            title: 'Etag'
                        },
                        messageType: {
                            type: 'string',
                            title: 'Message Type'
                        },
                        createdDateTime: {
                            type: 'string',
                            title: 'Created Date Time'
                        },
                        lastModifiedDateTime: {
                            type: 'string',
                            title: 'Last Modified Date Time'
                        },
                        lastEditedDateTime: {
                            type: 'string',
                            title: 'Last Edited Date Time'
                        },
                        deletedDateTime: {
                            type: 'string',
                            title: 'Deleted Date Time'
                        },
                        subject: {
                            type: 'string',
                            title: 'Subject'
                        },
                        summary: {
                            type: 'string',
                            title: 'Summary'
                        },
                        chatId: {
                            type: 'string',
                            title: 'Chat Id'
                        },
                        importance: {
                            type: 'string',
                            title: 'Importance'
                        },
                        locale: {
                            type: 'string',
                            title: 'Locale'
                        },
                        webUrl: {
                            type: 'string',
                            title: 'Web Url'
                        },
                        policyViolation: {
                            type: 'string',
                            title: 'Policy Violation'
                        },
                        eventDetail: {
                            type: 'string',
                            title: 'Event Detail'
                        },
                        from: {
                            type: 'string',
                            title: 'From'
                        },
                        body: {
                            type: 'string',
                            title: 'Body'
                        },
                        channelIdentity: {
                            type: 'string',
                            title: 'Channel Identity'
                        },
                        attachments: {
                            type: 'object',
                            title: 'Attachments'
                        },
                        mentions: {
                            type: 'string',
                            title: 'Mentions'
                        },
                        reactions: {
                            type: 'string',
                            title: 'Reactions'
                        },
                        messageHistory: {
                            type: 'object',
                            title: 'Message History'
                        }
                    }
                }
            } }], 'out');
        } else {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
