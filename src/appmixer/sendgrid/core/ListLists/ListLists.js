'use strict';

const lib = require('../../lib');

const schema = {
    'id': { 'type': 'string', 'title': 'ID' },
    'name': { 'type': 'string', 'title': 'Name' },
    'contact_count': { 'type': 'integer', 'title': 'Contact Count' }
};

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            const options = lib.getOutputPortOptions(context, outputType, schema, { label: 'Lists' });
            return context.sendJson(options, 'out');
        }

        const lists = await lib.paginatedApiRequest(context, '/marketing/lists', 'result');

        return lib.sendArrayOutput({
            context,
            outputType: outputType || 'array',
            records: lists
        });
    }
};
