'use strict';

const lib = require('../../lib');

// Output contract of a single team. Exported as ITEM_SCHEMA because the `out` port is dynamic.
const ITEM_SCHEMA = {
    'type': 'object',
    'properties': {
        'name': { 'type': 'string', 'title': 'Name', 'example': 'Sales' },
        'created_at': { 'type': 'string', 'format': 'date-time', 'title': 'Created At', 'example': '2026-01-15T10:30:00Z' }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Teams' });
        }

        const records = await lib.fetchAllPages(context, {
            url: `${lib.API_BASE_URL}/teams`,
            headers: lib.getHeaders(context)
        });

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
