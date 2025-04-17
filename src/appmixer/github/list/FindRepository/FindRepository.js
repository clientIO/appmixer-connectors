'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of repos
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { outputType, title } = context.messages.in.content;

        const query = `user:${context.auth.profileInfo.login}+${title}`;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const result = await lib.apiRequest(context, `search/repositories?q=${query}`);

        const items = (result.data.items || []).map(item => ({
            id: item.id,
            name: item.name,
            fullName: item.full_name,
            url: item.url,
            owner: item.owner.login,
            description: item.description

        }));

        if (items.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        if (outputType === 'first') {
            return context.sendJson({ repo: items[0], index: 0, count: items.length }, 'out');
        }

        if (outputType === 'array') {
            return context.sendJson({ items: items, count: items.length }, 'out');
        }

        if (outputType === 'object') {
            for (let index = 0; index < items.length; index++) {
                const repo = items[index];
                await context.sendJson({ repo, index, count: items.length }, 'out');
            }
        }

        if (outputType === 'file') {
            const headers = Object.keys(items[0]);
            const csvRows = [headers.join(',')];

            for (const repo of items) {
                const row = Object.values(repo).join(',');
                csvRows.push(row);
            }

            const csvString = csvRows.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const filename = `github-findRepos-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson({ fileId: savedFile.fileId, count: items.length }, 'out');
        }
    },
    getOutputPortOptions(context, outputType) {
        if (outputType === 'first' || outputType === 'object') {
            const options = [
                { label: 'Current Repo Index', value: 'index', schema: { type: 'integer' } },
                { label: 'Repos Count', value: 'count', schema: { type: 'integer' } },
                {
                    label: 'Repository',
                    value: 'repo',
                    schema: this.repoSchema
                }
            ];
            return context.sendJson(options, 'out');
        } else if (outputType === 'array') {
            const options = [
                { label: 'Repos Count', value: 'count', schema: { type: 'integer' } },
                {
                    label: 'Repositories',
                    value: 'items',
                    schema: {
                        type: 'array',
                        items: this.repoSchema
                    }
                }
            ];
            return context.sendJson(options, 'out');
        } else { // file
            return context.sendJson([
                { label: 'File ID', value: 'fileId' },
                { label: 'PRs Count', value: 'count', schema: { type: 'integer' } }
            ], 'out');
        }
    },

    repoSchema: {
        'type': 'object',
        'properties': {
            'id': {
                'type': 'string',
                'title': 'Repo ID'
            },
            'name': {
                'type': 'string',
                'title': 'Name'
            },
            'fullName': {
                'type': 'string',
                'title': 'Full Name'
            },
            'url': {
                'type': 'string',
                'title': 'URL'
            },
            'owner': {
                'type': 'string',
                'title': 'Owner'
            },
            'description': {
                'type': 'string',
                'title': 'Description'
            }
        }
    }
};
