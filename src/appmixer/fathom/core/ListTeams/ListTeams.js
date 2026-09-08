'use strict';

const lib = require('../../lib');

// Schema of a single team item.
const schema = {
    'name': { 'type': 'string', 'title': 'Name', 'example': 'Sales' },
    'created_at': { 'type': 'string', 'format': 'date-time', 'title': 'Created At', 'example': '2026-01-15T10:30:00Z' }
};

module.exports = {

    async receive(context) {

        const { outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Teams' });
        }

        const records = await lib.fetchAllPages(context, {
            url: `${lib.API_BASE_URL}/teams`,
            headers: lib.getHeaders(context)
        });

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
