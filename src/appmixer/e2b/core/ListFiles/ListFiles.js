'use strict';

const { Sandbox } = require('e2b');
const lib = require('../../lib');

// Schema of a single directory entry.
const schema = {
    name: { type: 'string', title: 'Name', example: 'data.csv' },
    path: { type: 'string', title: 'Path', example: '/home/user/data.csv' },
    type: { type: 'string', title: 'Type', example: 'file' }
};

module.exports = {

    async receive(context) {

        const { sandboxID, path, outputType = 'array' } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Files' });
        }

        if (!sandboxID) {
            throw new context.CancelError('Sandbox ID is required!');
        }
        if (!path) {
            throw new context.CancelError('Directory path is required!');
        }

        const sandbox = await Sandbox.connect(sandboxID, { apiKey: context.auth.apiKey });

        const entries = await sandbox.files.list(path);

        const records = (entries || []).map(entry => ({
            name: entry.name,
            path: entry.path,
            type: entry.type
        }));

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
