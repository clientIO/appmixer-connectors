'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'name'],
    properties: {
        id: { type: 'string', title: 'Field ID', example: '3' },
        name: { type: 'string', title: 'Name', example: 'E-mail' },
        stringId: { type: 'string', title: 'String ID', example: 'email' },
        applicationType: { type: 'string', title: 'Application Type', example: 'interests' }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { language, isSource, outputType = 'array' } = context.messages.in.content || {};

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, {
                label: 'Fields',
                value: 'result'
            });
        }

        // This component backs the field pickers on Find Contacts, which the designer fires in a
        // burst whenever that inspector opens. lib.getFields caches behind a lock either way; the
        // difference here is that a source call renders an empty dropdown (the user can still type
        // a field ID by hand) instead of popping an error the designer cannot act on.
        if (isSource) {
            try {
                const fields = await lib.getFields(context, language || lib.DEFAULT_LANGUAGE);
                return context.sendJson({ result: fields, count: fields.length }, 'out');
            } catch (err) {
                await context.log({ step: 'Could not load contact fields for a dropdown', message: err.message });
                return context.sendJson({ result: [], count: 0 }, 'out');
            }
        }

        const fields = await lib.getFields(context, language || lib.DEFAULT_LANGUAGE);

        return lib.sendArrayOutput({ context, outputType, records: fields });
    },

    // Field picker: the value is the numeric field ID, which is what every contact endpoint takes.
    toSelectArray({ result }) {

        return (result || []).map(field => ({
            label: field.stringId ? `${field.name} (${field.stringId})` : field.name || field.id,
            value: field.id
        }));
    },

    // Same list for the multi-select "fields to return" picker.
    toMultiselectArray({ result }) {

        return module.exports.toSelectArray({ result });
    }
};
