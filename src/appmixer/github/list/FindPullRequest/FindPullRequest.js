'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of pull requests from repository
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { repositoryId, state = 'all', outputType, title = '', labels = [] } = context.messages.in.content;

        const query = [
            `is:pr+repo:${repositoryId}+in:title+${title}`,
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
            return context.sendJson({ pullRequest: items[0], index: 0, count: items.length }, 'pullRequests');
        }

        if (outputType === 'array') {
            return context.sendJson({ items: items, count: items.length }, 'pullRequests');
        }

        if (outputType === 'object') {
            for (let index = 0; index < items.length; index++) {
                const pullRequest = items[index];
                await context.sendJson({ pullRequest, index, count: items.length }, 'pullRequests');
            }
        }

        if (outputType === 'file') {
            const headers = Object.keys(items[0]);
            const csvRows = [headers.join(',')];

            for (const pullRequest of items) {
                const row = Object.values(pullRequest).join(',');
                csvRows.push(row);
            }

            const csvString = csvRows.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const filename = `github-findPullRequests-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson({ fileId: savedFile.fileId, count: items.length }, 'pullRequests');
        }
    },
    getOutputPortOptions(context, outputType) {
        if (outputType === 'first' || outputType === 'object') {
            const options = [
                { label: 'Current PR Index', value: 'index', schema: { type: 'integer' } },
                { label: 'PRs Count', value: 'count', schema: { type: 'integer' } },
                {
                    label: 'Pull Request',
                    value: 'pullRequest',
                    schema: this.prSchema
                }
            ];
            return context.sendJson(options, 'pullRequests');
        } else if (outputType === 'array') {
            const options = [
                { label: 'PRs Count', value: 'count', schema: { type: 'integer' } },
                {
                    label: 'Pull Requests',
                    value: 'items',
                    schema: {
                        type: 'array',
                        items: this.prSchema
                    }
                }
            ];
            return context.sendJson(options, 'pullRequests');
        } else { // file
            return context.sendJson([
                { label: 'File ID', value: 'fileId' },
                { label: 'PRs Count', value: 'count', schema: { type: 'integer' } }
            ], 'pullRequests');
        }
    },

    prSchema: {
        'type': 'object',
        'properties': {
            'id': {
                'type': 'string',
                'title': 'Pull Request ID'
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
