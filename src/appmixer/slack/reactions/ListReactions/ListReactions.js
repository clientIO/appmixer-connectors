'use strict';

const { WebClient } = require('@slack/web-api');
const commons = require('../../lib');

const outputPortName = 'out';

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { userId, outputType, limit } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        // Initialize Slack Web API client
        const web = new WebClient(context.auth.accessToken);
        const result = await web.reactions.list({ user: userId, limit });

        await commons.sendArrayOutput({ context, outputType, records: result.items || [] });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'object' || outputType === 'first') {
            return context.sendJson([
                { label: 'Type', value: 'type', schema: { type: 'string' } },
                { label: 'Channel', value: 'channel', schema: { type: 'string' } },
                { label: 'Message', value: 'message', schema: {
                    type: 'object',
                    properties: {
                        text: { type: 'string', title: 'Text' },
                        files: { type: 'array', title: 'Files' },
                        user: { type: 'string', title: 'User' },
                        type: { type: 'string', title: 'Type' },
                        ts: { type: 'string', title: 'Timestamp' },
                        reactions: {
                            type: 'array',
                            title: 'Reactions',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string', title: 'Name' },
                                    count: { type: 'number', title: 'Count' },
                                    users: { type: 'array', title: 'Users' }
                                }
                            }
                        }
                    }
                } }
            ], outputPortName);
        } else if (outputType === 'array') {
            return context.sendJson([
                {
                    label: 'Reactions',
                    value: 'array',
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                type: { type: 'string', title: 'Type' },
                                channel: { type: 'string', title: 'Channel' },
                                message: {
                                    type: 'object',
                                    properties: {
                                        text: { type: 'string', title: 'Text' },
                                        files: { type: 'array', title: 'Files' },
                                        user: { type: 'string', title: 'User' },
                                        type: { type: 'string', title: 'Type' },
                                        ts: { type: 'string', title: 'Timestamp' },
                                        reactions: {
                                            type: 'array',
                                            title: 'Reactions',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    name: { type: 'string', title: 'Name' },
                                                    count: { type: 'number', title: 'Count' },
                                                    users: { type: 'array', title: 'Users' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ], outputPortName);
        } else if (outputType === 'file') {
            return context.sendJson([
                { label: 'File ID', value: 'fileId', schema: { type: 'string', format: 'appmixer-file-id' } }
            ], outputPortName);
        } else {
            // Default to array output
            return context.sendJson([], outputPortName);
        }
    }
};
