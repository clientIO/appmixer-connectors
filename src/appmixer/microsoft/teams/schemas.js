'use strict';

// Output schemas shared by several Teams components. SendChannelMessage declares the
// chatMessage schema statically in its component.json; a unit test keeps the two in sync.

const identity = (prefix, example) => ({
    type: 'object',
    title: prefix,
    required: ['id'],
    properties: {
        id: { type: 'string', title: `${prefix}.ID`, example: example.id },
        displayName: { type: 'string', title: `${prefix}.Display Name`, example: example.displayName },
        [example.typeField]: {
            type: 'string',
            title: `${prefix}.Identity Type`,
            example: example.type
        }
    }
});

const chatMessage = {
    type: 'object',
    required: ['id', 'messageType', 'createdDateTime', 'body'],
    properties: {
        id: { type: 'string', title: 'Message ID', example: '1616990032035' },
        replyToId: { type: 'string', title: 'Reply To ID', example: '1616989510408' },
        etag: { type: 'string', title: 'ETag', example: '1616990032035' },
        messageType: { type: 'string', title: 'Message Type', example: 'message' },
        createdDateTime: {
            type: 'string',
            format: 'date-time',
            title: 'Created Date Time',
            example: '2026-09-15T08:30:00.035Z'
        },
        lastModifiedDateTime: {
            type: 'string',
            format: 'date-time',
            title: 'Last Modified Date Time',
            example: '2026-09-15T08:30:00.035Z'
        },
        lastEditedDateTime: {
            type: 'string',
            format: 'date-time',
            title: 'Last Edited Date Time',
            example: '2026-09-15T08:45:12.401Z'
        },
        deletedDateTime: {
            type: 'string',
            format: 'date-time',
            title: 'Deleted Date Time',
            example: '2026-09-15T09:00:00.000Z'
        },
        subject: { type: 'string', title: 'Subject', example: 'Quarterly results' },
        summary: { type: 'string', title: 'Summary', example: 'Summary of the quarterly results' },
        chatId: { type: 'string', title: 'Chat ID', example: '19:2da4c29f6d7041eca70b638b43d45437@thread.v2' },
        importance: { type: 'string', title: 'Importance', example: 'normal' },
        locale: { type: 'string', title: 'Locale', example: 'en-us' },
        webUrl: {
            type: 'string',
            title: 'Web URL',
            example: 'https://teams.microsoft.com/l/message/19%3A4a95f7d8db4c4e7fae857bcebe0623e6%40thread.tacv2/1616990032035'
        },
        channelIdentity: {
            type: 'object',
            title: 'Channel Identity',
            properties: {
                teamId: {
                    type: 'string',
                    title: 'Channel Identity.Team ID',
                    example: 'fbe2bf47-16c8-47cf-b4a5-4b9b187c508b'
                },
                channelId: {
                    type: 'string',
                    title: 'Channel Identity.Channel ID',
                    example: '19:4a95f7d8db4c4e7fae857bcebe0623e6@thread.tacv2'
                }
            }
        },
        from: {
            type: 'object',
            title: 'From',
            properties: {
                user: identity('From.User', {
                    id: '8ea0e38b-efb3-4757-924a-5f94061cf8c2',
                    displayName: 'Robin Kline',
                    typeField: 'userIdentityType',
                    type: 'aadUser'
                }),
                application: identity('From.Application', {
                    id: '28b4ee7f-4d35-4a28-9bd0-4e9a3f0cd0a8',
                    displayName: 'Appmixer',
                    typeField: 'applicationIdentityType',
                    type: 'bot'
                })
            }
        },
        body: {
            type: 'object',
            title: 'Body',
            required: ['contentType', 'content'],
            properties: {
                contentType: { type: 'string', title: 'Body.Content Type', example: 'html' },
                content: { type: 'string', title: 'Body.Content', example: '<p>Hello World</p>' }
            }
        },
        attachments: {
            type: 'array',
            title: 'Attachments',
            example: [{
                id: '153fa47d-18c9-4179-be08-9879815a9f90',
                contentType: 'reference',
                contentUrl: 'https://contoso.sharepoint.com/sites/Team/Shared%20Documents/General/report.docx',
                name: 'report.docx'
            }],
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', title: 'ID', example: '153fa47d-18c9-4179-be08-9879815a9f90' },
                    contentType: { type: 'string', title: 'Content Type', example: 'reference' },
                    contentUrl: {
                        type: 'string',
                        title: 'Content URL',
                        example: 'https://contoso.sharepoint.com/sites/Team/Shared%20Documents/General/report.docx'
                    },
                    content: { type: 'string', title: 'Content', example: '' },
                    name: { type: 'string', title: 'Name', example: 'report.docx' },
                    thumbnailUrl: { type: 'string', title: 'Thumbnail URL', example: '' },
                    teamsAppId: { type: 'string', title: 'Teams App ID', example: '' }
                }
            }
        },
        mentions: {
            type: 'array',
            title: 'Mentions',
            example: [{
                id: 0,
                mentionText: 'Robin Kline',
                mentioned: {
                    user: { id: '8ea0e38b-efb3-4757-924a-5f94061cf8c2', displayName: 'Robin Kline', userIdentityType: 'aadUser' }
                }
            }],
            items: {
                type: 'object',
                properties: {
                    id: { type: 'integer', title: 'ID', example: 0 },
                    mentionText: { type: 'string', title: 'Mention Text', example: 'Robin Kline' },
                    mentioned: {
                        type: 'object',
                        title: 'Mentioned',
                        properties: {
                            user: identity('Mentioned.User', {
                                id: '8ea0e38b-efb3-4757-924a-5f94061cf8c2',
                                displayName: 'Robin Kline',
                                typeField: 'userIdentityType',
                                type: 'aadUser'
                            })
                        }
                    }
                }
            }
        },
        reactions: {
            type: 'array',
            title: 'Reactions',
            example: [{
                reactionType: '👍',
                displayName: 'Like',
                createdDateTime: '2026-09-15T08:31:07.000Z',
                user: {
                    user: { id: '8ea0e38b-efb3-4757-924a-5f94061cf8c2', displayName: 'Robin Kline', userIdentityType: 'aadUser' }
                }
            }],
            items: {
                type: 'object',
                properties: {
                    reactionType: { type: 'string', title: 'Reaction Type', example: '👍' },
                    displayName: { type: 'string', title: 'Display Name', example: 'Like' },
                    createdDateTime: {
                        type: 'string',
                        format: 'date-time',
                        title: 'Created Date Time',
                        example: '2026-09-15T08:31:07.000Z'
                    },
                    user: {
                        type: 'object',
                        title: 'User',
                        properties: {
                            user: identity('User.User', {
                                id: '8ea0e38b-efb3-4757-924a-5f94061cf8c2',
                                displayName: 'Robin Kline',
                                typeField: 'userIdentityType',
                                type: 'aadUser'
                            })
                        }
                    }
                }
            }
        }
    }
};

module.exports = { chatMessage };
