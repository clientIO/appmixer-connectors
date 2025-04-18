'use strict';

const { generateAuthorizationHeader } = require('../../lib');
const { sendArrayOutput } = require('../../searchOutput');

const outputPortName = 'out';

module.exports = {
    async receive(context) {
        const { hostnameUrl, accessToken, clientSecret, clientToken } =
            context.auth;
        const { generateOutputPortOptions } = context.properties;
        const { outputType, isSource } = context.messages.in.content;

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
            path: '/client-list/v1/lists'
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

    listsToSelectArray(lists) {
        return lists.map((list) => {
            return { label: `${list.name} <${list.type}>`, value: list.listId };
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
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'Created By',
                            value: 'createdBy',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'Deprecated',
                            value: 'deprecated',
                            schema: {
                                type: 'boolean'
                            }
                        },
                        {
                            label: 'Items Count',
                            value: 'itemsCount',
                            schema: {
                                type: 'number'
                            }
                        },
                        {
                            label: 'List Id',
                            value: 'listId',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'List Type',
                            value: 'listType',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'Name',
                            value: 'name',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'Notes',
                            value: 'notes',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'Production Activation Status',
                            value: 'productionActivationStatus',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'Production Active Version',
                            value: 'productionActiveVersion',
                            schema: {
                                type: 'number'
                            }
                        },
                        {
                            label: 'Read Only',
                            value: 'readOnly',
                            schema: {
                                type: 'boolean'
                            }
                        },
                        {
                            label: 'Shared',
                            value: 'shared',
                            schema: {
                                type: 'boolean'
                            }
                        },
                        {
                            label: 'Staging Activation Status',
                            value: 'stagingActivationStatus',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            label: 'Staging Active Version',
                            value: 'stagingActiveVersion',
                            schema: {
                                type: 'number'
                            }
                        },
                        {
                            label: 'Tags',
                            value: 'tags',
                            schema: {
                                type: 'array',
                                items: {
                                    type: 'string'
                                }
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
                            label: 'Version',
                            value: 'version',
                            schema: {
                                type: 'number'
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
                            label: 'Lists',
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
                                        deprecated: {
                                            type: 'boolean',
                                            title: 'Deprecated'
                                        },
                                        itemsCount: {
                                            type: 'number',
                                            title: 'Items Count'
                                        },
                                        listId: {
                                            type: 'string',
                                            title: 'List Id'
                                        },
                                        listType: {
                                            type: 'string',
                                            title: 'List Type'
                                        },
                                        name: {
                                            type: 'string',
                                            title: 'Name'
                                        },
                                        notes: {
                                            type: 'string',
                                            title: 'Notes'
                                        },
                                        productionActivationStatus: {
                                            type: 'string',
                                            title: 'Production Activation Status'
                                        },
                                        productionActiveVersion: {
                                            type: 'number',
                                            title: 'Production Active Version'
                                        },
                                        readOnly: {
                                            type: 'boolean',
                                            title: 'Read Only'
                                        },
                                        shared: {
                                            type: 'boolean',
                                            title: 'Shared'
                                        },
                                        stagingActivationStatus: {
                                            type: 'string',
                                            title: 'Staging Activation Status'
                                        },
                                        stagingActiveVersion: {
                                            type: 'number',
                                            title: 'Staging Active Version'
                                        },
                                        tags: {
                                            type: 'array',
                                            items: {
                                                type: 'string'
                                            },
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
                                        version: {
                                            type: 'number',
                                            title: 'Version'
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
