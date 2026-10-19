'use strict';

const lib = require('../../lib');

const SCHEMA = {
    name: { type: 'string', title: 'Hub Name', example: 'Contacts Import' },
    conversionKey: { type: 'string', title: 'Conversion Key', example: 'a1b2c3d4-0000-1111-2222-333344445555' }
};

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, SCHEMA, { label: 'Source Hubs', value: 'result' });
        }

        const hubs = await lib.listHubs(context, lib.ENDPOINTS.listSourceHubsWithPostData);

        return lib.sendArrayOutput({ context, outputType, records: hubs });
    },

    toSelectArray(msg) {
        const items = msg.result || (Array.isArray(msg) ? msg : []);
        return items.map(hub => ({ label: hub.name || hub.conversionKey, value: hub.conversionKey }));
    }
};
