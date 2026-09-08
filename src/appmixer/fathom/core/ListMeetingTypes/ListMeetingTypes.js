'use strict';

const lib = require('../../lib');

// Schema of a single meeting type item.
const schema = {
    'name': { 'type': 'string', 'title': 'Name', 'example': 'Sales Call' },
    'active': { 'type': 'boolean', 'title': 'Active', 'example': true }
};

module.exports = {

    async receive(context) {

        const { outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Meeting Types' });
        }

        const records = await lib.fetchAllPages(context, {
            url: `${lib.API_BASE_URL}/meeting_types`,
            headers: lib.getHeaders(context)
        });

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
