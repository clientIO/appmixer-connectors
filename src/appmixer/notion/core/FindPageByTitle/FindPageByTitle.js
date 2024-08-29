'use strict';

const lib = require('../../lib');
const { sendArrayOutput } = require('../../lib');

module.exports = {
    async receive(context) {
        const { title, outputType } = context.messages.in.content;
        const generateOutputPortOptions = context.properties.generateOutputPortOptions;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const requestData = {
            query: title,
            filter: {
                property: 'object',
                value: 'page'
            },
            page_size: 100
        };

        const response = await lib.callEndpoint(context, '/search', {
            method: 'POST',
            data: requestData
        });

        const pages = response.data.results.map((page) => {
            const pageTitle = page.properties?.title?.title?.[0]?.text?.content || 'Untitled';
            return {
                pageTitle,
                pageId: page.id
            };
        });

        return sendArrayOutput({ context, outputType, records: pages });
    },

    getOutputPortOptions(context, outputType) {
        const options = [
            { label: 'Page Title', value: 'pageTitle' },
            { label: 'Page ID', value: 'pageId' }
        ];

        if (outputType === 'first' || outputType === 'object') {
            return context.sendJson(options, 'out');
        } else if (outputType === 'array') {
            return context.sendJson([
                {
                    label: 'Pages',
                    value: 'result',
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                pageTitle: { label: 'Page Title', value: 'pageTitle' },
                                pageId: { label: 'Page ID', value: 'pageId' }
                            }
                        }
                    }
                }
            ], 'out');
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
