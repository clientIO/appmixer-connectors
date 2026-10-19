'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {
        const { title, outputType } = context.messages.in.content;
        const generateOutputPortOptions = context.properties.generateOutputPortOptions;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        // An empty query makes the search return every page.
        if (!title) {
            throw new context.CancelError('Title is required!');
        }
        if (!outputType) {
            throw new context.CancelError('Output Type is required!');
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
            const titleProperty = Object.values(page.properties).find(prop => prop.type === 'title');
            // All fragments, as plain text: a title can be split into several rich-text
            // fragments, and a mention fragment carries no `text`.
            const pageTitle = (titleProperty?.title || []).map(fragment => fragment.plain_text).join('') || 'Untitled';

            return {
                id: page.id,
                title: pageTitle
            };
        });

        if (pages.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        // For first outputType
        if (outputType === 'first') {
            return context.sendJson({ page: pages[0], index: 0, count: pages.length }, 'out');
        }

        // For array outputType
        if (outputType === 'array') {
            return context.sendJson({ pages, count: pages.length }, 'out');
        }

        // For object outputType
        if (outputType === 'object') {
            for (let index = 0; index < pages.length; index++) {
                await context.sendJson({ page: pages[index], index, count: pages.length }, 'out');
            }
        }

        // For file outputType
        if (outputType === 'file') {
            const buffer = Buffer.from(lib.toCsv(pages), 'utf8');
            const filename = `notion-findpagesbytitle-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson({ fileId: savedFile.fileId, count: pages.length }, 'out');
        }
    },

    getOutputPortOptions(context, outputType) {
        const pageSchema = {
            type: 'object',
            properties: {
                id: { type: 'string', title: 'Page ID' },
                title: { type: 'string', title: 'Page Title' }
            }
        };

        if (outputType === 'first' || outputType === 'object') {
            return context.sendJson([
                { label: 'Current Page Index', value: 'index', schema: { type: 'integer' } },
                { label: 'Pages Count', value: 'count', schema: { type: 'integer' } },
                { label: 'Page', value: 'page', schema: pageSchema }
            ], 'out');
        } else if (outputType === 'array') {
            return context.sendJson([
                { label: 'Pages Count', value: 'count', schema: { type: 'integer' } },
                {
                    label: 'Pages',
                    value: 'pages',
                    schema: {
                        type: 'array',
                        items: pageSchema
                    }
                }
            ], 'out');
        } else { // file
            return context.sendJson([
                { label: 'File ID', value: 'fileId' },
                { label: 'Pages Count', value: 'count', schema: { type: 'integer' } }
            ], 'out');
        }
    }
};
