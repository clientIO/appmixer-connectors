'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of issues from repository
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { repositoryId, state = 'all', outputType, title = '', labels = [] } = context.messages.in.content;

        const query = [
            `is:issue+repo:${repositoryId}+in:title+${title}`,
            labels.length ? `label:${labels.map(label => `"${label}"`).join(',')}` : '',
            state !== 'all' ? `state:${state}` : ''
        ].filter(Boolean).join('+');

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const result = await lib.apiRequest(context, `search/issues?q=${query}`);

        const items = (result.data.items || []).map(item => ({
            id: item.id,
            title: item.title,
            state: item.state,
            url: item.url

        }));

        if (items.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        if (outputType === 'first') {
            return context.sendJson({ issue: items[0], index: 0, count: items.length }, 'out');
        }

        if (outputType === 'array') {
            return context.sendJson({ items: items, count: items.length }, 'out');
        }

        if (outputType === 'object') {
            for (let index = 0; index < items.length; index++) {
                const issue = items[index];
                await context.sendJson({ issue, index, count: items.length }, 'out');
            }
        }

        if (outputType === 'file') {
            const headers = Object.keys(items[0]);
            const csvRows = [headers.join(',')];

            for (const issue of items) {
                const row = Object.values(issue).join(',');
                csvRows.push(row);
            }

            const csvString = csvRows.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const filename = `github-findIssue-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson({ fileId: savedFile.fileId, count: items.length }, 'out');
        }
    },
    getOutputPortOptions(context, outputType) {
        if (outputType === 'first' || outputType === 'object') {
            const options = [
                { label: 'Current Issue Index', value: 'index', schema: { type: 'integer' } },
                { label: 'Issues Count', value: 'count', schema: { type: 'integer' } },
                {
                    label: 'Issue',
                    value: 'Issue',
                    schema: this.issueSchema
                }
            ];
            return context.sendJson(options, 'out');
        } else if (outputType === 'array') {
            const options = [
                { label: 'Issues Count', value: 'count', schema: { type: 'integer' } },
                {
                    label: 'Issues',
                    value: 'items',
                    schema: {
                        type: 'array',
                        items: this.issueSchema
                    }
                }
            ];
            return context.sendJson(options, 'out');
        } else { // file
            return context.sendJson([
                { label: 'File ID', value: 'fileId' },
                { label: 'Issues Count', value: 'count', schema: { type: 'integer' } }
            ], 'out');
        }
    },

    issueSchema: {
        'type': 'object',
        'properties': {
            'id': {
                'type': 'string',
                'title': 'Issue ID'
            },
            'title': {
                'type': 'string',
                'title': 'Title'
            },
            'state': {
                'type': 'string',
                'title': 'State'
            },
            'url': {
                'type': 'string',
                'title': 'URL'
            }
        }
    }
};
