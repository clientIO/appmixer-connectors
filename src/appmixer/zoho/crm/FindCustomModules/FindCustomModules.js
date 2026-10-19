'use strict';
const ZohoClient = require('../../ZohoClient');
const lib = require('../lib');

// The out port is dynamic (outputType), so the item contract is exported for the offline tooling
// (`appmixer connector verify`, outport-nested-title-prefix).
const ITEM_SCHEMA = {
    type: 'object',
    properties: lib.schemas.module,
    required: ['id', 'api_name']
};

/**
 * Find custom modules of the organization. Zoho has no search on module metadata, so the full
 * module list (a few dozen entries) is read and filtered here.
 */
module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { query, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, {
                label: 'Custom Modules',
                value: 'result'
            });
        }

        const client = new ZohoClient(context, undefined, { apiVersion: lib.MODULES_API_VERSION });
        const modules = await lib.getModules(client);

        const needle = String(query || '').trim().toLowerCase();
        const records = modules
            .filter(module => module.generated_type === lib.MODULE_GENERATED_TYPE_CUSTOM)
            .filter(module => !needle || [module.api_name, module.singular_label, module.plural_label]
                .some(value => String(value || '').toLowerCase().includes(needle)));

        if (!records.length) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
