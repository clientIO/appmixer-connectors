'use strict';

const { generateAuthorizationHeader } = require('../../signature');
const { sendArrayOutput } = require('../../searchOutput');

const outputPortName = 'out';

module.exports = {
    async receive(context) {
        const { hostnameUrl, accessToken, clientSecret, clientToken } =
            context.auth;
        const { generateOutputPortOptions } = context.properties;
        const { listId, outputType, isSource } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const {
            url,
            method,
            headers: { Authorization }
        } = generateAuthorizationHeader({
            hostnameUrl,
            accessToken,
            clientToken,
            clientSecret,
            method: 'GET',
            path: `/client-list/v1/lists/${listId}/items`
        });

        const { data } = await context.httpRequest({
            url,
            method,
            headers: { Authorization }
        });

        const { content } = data;

        if (isSource) {
            if (content.length === 0) {
                return context.sendJson({}, 'out');
            }
            return context.sendJson(content, 'out');
        }

        if (content.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return await sendArrayOutput({
            context,
            outputPortName,
            outputType,
            records: content
        });
    },

    getOutputPortOptions(context, outputType) {
        switch (outputType) {
            case 'object':
            case 'first':
                return context.sendJson(
                    [
                        {
                            label: 'Current Page Index',
                            value: 'index',
                            schema: { type: 'integer' }
                        },
                        {
                            label: 'Pages Count',
                            value: 'count',
                            schema: { type: 'integer' }
                        },
                        {
                            label: 'Create Date',
                            value: 'createDate',
                            schema: { type: 'string' }
                        },
                        {
                            label: 'Created By',
                            value: 'createdBy',
                            schema: { type: 'string' }
                        },
                        {
                            label: 'Description',
                            value: 'description',
                            schema: { type: 'string' }
                        },
                        {
                            label: 'Expiration Date',
                            value: 'expirationDate',
                            schema: { type: 'string' }
                        },
                        {
                            label: 'Production Status',
                            value: 'productionStatus',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'Staging Status',
                            value: 'stagingStatus',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'Tags',
                            value: 'tags',
                            schema: {
                                type: 'array',
                                items: {}
                            }
                        },
                        {
                            label: 'Type',
                            value: 'type',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'Update Date',
                            value: 'updateDate',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'Updated By',
                            value: 'updatedBy',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'Value',
                            value: 'value',
                            schema: {
                                type: 'string'
                            }
                        }
                    ],
                    outputPortName
                );

            case 'array':
                return context.sendJson(
                    [
                        {
                            label: 'Pages Count',
                            value: 'count',
                            schema: { type: 'integer' }
                        },
                        {
                            label: 'List Entries',
                            value: 'records',
                            schema: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        createDate: {
                                            type: 'string',
                                            title: 'Create Date'
                                        },
                                        createdBy: {
                                            type: 'string',
                                            title: 'Created By'
                                        },
                                        description: {
                                            type: 'string',
                                            title: 'Description'
                                        },
                                        expirationDate: {
                                            type: 'string',
                                            title: 'Expiration Date'
                                        },
                                        productionStatus: {
                                            type: 'string',
                                            title: 'Production Status'
                                        },
                                        stagingStatus: {
                                            type: 'string',
                                            title: 'Staging Status'
                                        },
                                        tags: {
                                            type: 'array',
                                            items: {},
                                            title: 'Tags'
                                        },
                                        type: {
                                            type: 'string',
                                            title: 'Type'
                                        },
                                        updateDate: {
                                            type: 'string',
                                            title: 'Update Date'
                                        },
                                        updatedBy: {
                                            type: 'string',
                                            title: 'Updated By'
                                        },
                                        value: {
                                            type: 'string',
                                            title: 'Value'
                                        }
                                    }
                                }
                            }
                        }
                    ],
                    outputPortName
                );

            case 'file':
                return context.sendJson(
                    [
                        {
                            label: 'File ID',
                            value: 'fileId',
                            schema: {
                                type: 'string',
                                format: 'appmixer-file-id'
                            }
                        },
                        {
                            label: 'Pages Count',
                            value: 'count',
                            schema: { type: 'integer' }
                        }
                    ],
                    outputPortName
                );

            default:
                throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    }
};
