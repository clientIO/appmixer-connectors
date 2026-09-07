'use strict';

const lib = require('../../lib');

// Schema of a single active zone. Shared by the live path and the
// generateOutputPortOptions path so the designer always shows what is sent.
const schema = {
    'name': { 'type': 'string', 'title': 'Zone Name', 'example': 'web_unlocker1' },
    'type': { 'type': 'string', 'title': 'Zone Type', 'example': 'unblocker' }
};

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Zones' });
        }

        const response = await lib.makeRequest({
            context,
            method: 'GET',
            path: '/zone/get_active_zones'
        });

        const zones = Array.isArray(response) ? response : [];

        return lib.sendArrayOutput({ context, records: zones, outputType });
    }
};
