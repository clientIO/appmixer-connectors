'use strict';
const { pager } = require('../../dropbox-commons');
const pathModule = require('path');

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
        } else if (outputType === 'file') {
            return context.sendArray(files, 'out');
        } else if (outputType === 'saveToFile') {
            // Into CSV file.
            const headers = Object.keys(files[0] || {});
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const record of files) {
                const values = headers.map(header => {
                    const val = record[header];
                    return `"${val}"`;
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'dropbox-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'file') {
            return context.sendJson(
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
