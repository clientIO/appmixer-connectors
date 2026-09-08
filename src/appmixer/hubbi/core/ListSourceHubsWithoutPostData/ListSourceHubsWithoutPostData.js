'use strict';

const lib = require('../../lib');

const SCHEMA = {
    name: { type: 'string', title: 'Hub Name', example: 'Nightly Sync' },
    conversionKey: { type: 'string', title: 'Conversion Key', example: 'c1d2e3f4-0000-1111-2222-333344445555' }
};

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, SCHEMA, { label: 'Source Hubs', value: 'result' });
        }

        const hubs = await lib.listHubs(context, lib.ENDPOINTS.listSourceHubsWithoutPostData);

        return lib.sendArrayOutput({ context, outputType, records: hubs });
    },

    toSelectArray(msg) {
        const items = msg.result || (Array.isArray(msg) ? msg : []);
        return items.map(hub => ({ label: hub.name || hub.conversionKey, value: hub.conversionKey }));
    }
};
