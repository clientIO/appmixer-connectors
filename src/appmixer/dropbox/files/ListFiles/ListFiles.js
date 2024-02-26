'use strict';
const { pager } = require('../../dropbox-commons');

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(
                context,
                outputType
            );
        }

        const files = await pager(context.auth.accessToken, false, null, context);

        if (outputType === 'files') {
            return context.sendJson({ files }, 'out');
        }

        const headers = Object.keys(files[0]);
        const csvRows = [headers.join(',')];

        for (const file of files) {
            if (outputType === 'file') {
                await context.sendJson(file, 'out');
            } else {
                const row = Object.values(file).join(',');
                csvRows.push(row);
            }
        }

        if (outputType === 'saveToFile') {
            const csvString = csvRows.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const filename = `dropbox-list-files-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        }
        return context.sendJson(files, 'files');
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'file') {
            return context.sendJson(
                [
                    [
                        {
                            label: 'Tag',
                            value: '.tag'
                        },
                        {
                            label: 'Client Modified',
                            value: 'client_modified'
                        },
                        {
                            label: 'Content Hash',
                            value: 'content_hash'
                        },
                        {
                            label: 'Id',
                            value: 'id'
                        },
                        {
                            label: 'Name',
                            value: 'name'
                        },
                        {
                            label: 'Path Display',
                            value: 'path_display'
                        },
                        {
                            label: 'Path Lower',
                            value: 'path_lower'
                        },
                        {
                            label: 'Rev',
                            value: 'rev'
                        },
                        {
                            label: 'Server Modified',
                            value: 'server_modified'
                        },
                        {
                            label: 'Size',
                            value: 'size'
                        }
                    ]
                ],
                'out'
            );
        } else if (outputType === 'files') {
            return context.sendJson(
                [
                    {
                        label: 'Files',
                        value: 'files',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    '.tag': {
                                        type: 'string',
                                        title: 'Tag'
                                    },
                                    clientModified: {
                                        type: 'string',
                                        title: 'Client Modified'
                                    },
                                    contentHash: {
                                        type: 'string',
                                        title: 'Content Hash'
                                    },
                                    id: {
                                        type: 'string',
                                        title: 'Id'
                                    },
                                    name: {
                                        type: 'string',
                                        title: 'Name'
                                    },
                                    pathDisplay: {
                                        type: 'string',
                                        title: 'Path Display'
                                    },
                                    pathLower: {
                                        type: 'string',
                                        title: 'Path Lower'
                                    },
                                    rev: {
                                        type: 'string',
                                        title: 'Rev'
                                    },
                                    serverModified: {
                                        type: 'string',
                                        title: 'Server Modified'
                                    },
                                    size: {
                                        type: 'string',
                                        title: 'Size'
                                    }
                                }
                            }
                        }
                    }
                ],
                'out'
            );
        } else {
            // outputType === 'saveToFile'
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    },

    filesToSelectArray(files) {

        if (files && Array.isArray(files)) {
            return files.map((file) => ({
                label: file.name,
                value: file.id
            }));
        }
        return [];
    }
};
