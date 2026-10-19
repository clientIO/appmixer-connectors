'use strict';
const lib = require('../../lib');

/**
 * Finds files in a repository tree by name, optionally under a path, at a branch, tag or commit.
 * One request: the Git Trees API with recursive=1 returns the whole tree.
 * @extends {Component}
 */
const ITEM_SCHEMA = {
    'type': 'object',
    'properties': {
        'path': {
            'type': 'string',
            'title': 'Path',
            'example': 'src/connectors/github/bundle.json'
        },
        'name': {
            'type': 'string',
            'title': 'Name',
            'example': 'bundle.json'
        },
        'directory': {
            'type': 'string',
            'title': 'Directory',
            'example': 'src/connectors/github'
        },
        'sha': {
            'type': 'string',
            'title': 'SHA',
            'example': '9c2af91d2609dd42f6652d4729bf7eb971ff151d'
        },
        'size': {
            'type': 'integer',
            'title': 'Size',
            'example': 1432
        },
        'url': {
            'type': 'string',
            'title': 'URL',
            'example': 'https://github.com/octo-org/octo-repo/blob/main/src/connectors/github/bundle.json'
        }
    }
};

// `owner/repo`, or the repository URL as other GitHub components output it.
const normalizeRepository = (repositoryId) => {

    return String(repositoryId).trim()
        .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
        .replace(/\.git$/, '')
        .replace(/\/+$/, '');
};

// File name with `*` as a wildcard, e.g. `*.json` — matched against the file name only.
const nameMatcher = (name) => {

    const pattern = String(name).trim().split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*');
    return new RegExp(`^${pattern}$`);
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { repositoryId, ref, name, path, outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Files' });
        }

        if (!repositoryId) {
            throw new context.CancelError('Repository is required!');
        }
        if (!name) {
            throw new context.CancelError('File name is required!');
        }

        const repository = normalizeRepository(repositoryId);
        let treeRef = ref && String(ref).trim();
        if (!treeRef) {
            const { data: repo } = await lib.apiRequest(context, `repos/${repository}`);
            treeRef = repo.default_branch;
        }

        const { data } = await lib.apiRequest(context, `repos/${repository}/git/trees/${treeRef}`, {
            params: { recursive: 1 }
        });

        // A partial tree would give incomplete results, or notFound for a file that exists.
        if (data.truncated) {
            throw new context.CancelError('GitHub returned a truncated tree (over 100 000 entries or 7 MB); the repository is too large to search.');
        }

        const matchesName = nameMatcher(name);
        const prefix = path ? String(path).trim().replace(/^\/+|\/+$/g, '') : '';

        const records = (data.tree || [])
            .filter(entry => entry.type === 'blob')
            .filter(entry => !prefix || entry.path === prefix || entry.path.startsWith(prefix + '/'))
            .map(entry => {
                const slash = entry.path.lastIndexOf('/');
                return {
                    path: entry.path,
                    name: slash === -1 ? entry.path : entry.path.slice(slash + 1),
                    directory: slash === -1 ? '' : entry.path.slice(0, slash),
                    sha: entry.sha,
                    size: entry.size,
                    url: `https://github.com/${repository}/blob/${treeRef}/${entry.path}`
                };
            })
            .filter(record => matchesName.test(record.name));

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
