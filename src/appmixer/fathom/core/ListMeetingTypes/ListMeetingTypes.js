'use strict';

const lib = require('../../lib');

// Output contract of a single meeting type. Exported as ITEM_SCHEMA because the `out` port is dynamic.
const ITEM_SCHEMA = {
    'type': 'object',
    'properties': {
        'name': { 'type': 'string', 'title': 'Name', 'example': 'Sales Call' },
        'active': { 'type': 'boolean', 'title': 'Active', 'example': true }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Meeting Types' });
        }

        const records = await lib.fetchAllPages(context, {
            url: `${lib.API_BASE_URL}/meeting_types`,
            headers: lib.getHeaders(context)
        });

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
