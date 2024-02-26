'use strict';
const { makeRequest } = require('../../commons');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.outputType);
        }

        const { query, outputType } = context.messages.in.content;

        // Remove extra spaces and line breaks.
        const searchTerm = query?.replace(/\s+/g, ' ').trim();

        const options = {
            path: `v3/company/${context.profileInfo.companyId}/query?query=${encodeURIComponent(searchTerm)}`,
            method: 'GET',
            data: null
        };
        const {
            data: { QueryResponse }
        } = await makeRequest({
            context,
            options
        });
        const items = Object.values(QueryResponse).find((value) => Array.isArray(value));

        if (!items || items.length === 0) {
            return context.sendJson({ query }, 'notFound');
        }

        if (outputType === 'items') {
            return context.sendJson({ items }, 'out');
        }

        const headers = Object.keys(items[0]);
        const csvRows = [headers.join(',')];

        for (const item of items) {
            if (outputType === 'item') {
                await context.sendJson(item, 'out');
            } else {
                const r = Object.values(item).join(',');
                csvRows.push(r);
            }
        }

        if (outputType === 'file') {
            const csvString = csvRows.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const filename = `quickbooks-query-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson(savedFile, 'out');
        }
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson([{ label: 'Item', value: 'item' }], 'out');
        } else if (outputType === 'items') {
            return context.sendJson([{ label: 'Items', value: 'items' }], 'out');
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
