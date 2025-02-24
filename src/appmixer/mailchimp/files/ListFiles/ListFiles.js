'use strict';
const aggregators = require('../../aggregators');
const { sendArrayOutput } = require('../../commons');

/**
 * Component listing lists
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { outputType } = context.messages.in.content;


        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        return aggregators.getFiles({
            context
        }).then(files => {
            return sendArrayOutput({ context, outputPortName: 'out', outputType, records: files });
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    {
                        label: 'Id',
                        value: 'id'
                    },
                    {
                        label: 'Created At',
                        value: 'created_at'
                    },
                    {
                        label: 'Created By',
                        value: 'created_by'
                    },
                    {
                        label: 'Folder Id',
                        value: 'folder_id'
                    },
                    {
                        label: 'Full Size Url',
                        value: 'full_size_url'
                    },
                    {
                        label: 'Height',
                        value: 'height'
                    },
                    {
                        label: 'Name',
                        value: 'name'
                    },
                    {
                        label: 'Size',
                        value: 'size'
                    },
                    {
                        label: 'Contact City',
                        value: 'contact.city'
                    },
                    {
                        label: 'Thumbnail Url',
                        value: 'thumbnail_url'
                    },
                    {
                        label: 'Type',
                        value: 'type'
                    },
                    {
                        label: 'Width',
                        value: 'width'
                    }
                ],
                'out'
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Files',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: {
                                        type: 'string',
                                        title: 'Id'
                                    },
                                    created_at: {
                                        type: 'string',
                                        title: 'Created At'
                                    },
                                    created_by: {
                                        type: 'string',
                                        title: 'Created By'
                                    },
                                    folder_id: {
                                        type: 'string',
                                        title: 'Folder Id'
                                    },
                                    full_size_url: {
                                        type: 'string',
                                        title: 'Full Size Url'
                                    },
                                    height: {
                                        type: 'string',
                                        title: 'Height'
                                    },
                                    name: {
                                        type: 'string',
                                        title: 'Name'
                                    },
                                    size: {
                                        type: 'string',
                                        title: 'Size'
                                    },
                                    'contact.city': {
                                        type: 'string',
                                        title: 'Contact City'
                                    },
                                    thumbnail_url: {
                                        type: 'string',
                                        title: 'Thumbnail Url'
                                    },
                                    type: {
                                        type: 'string',
                                        title: 'Type'
                                    },
                                    width: {
                                        type: 'string',
                                        title: 'Width'
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
    }
};
