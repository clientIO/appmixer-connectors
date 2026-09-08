'use strict';

const lib = require('../lib');

// The output contract of one Groq model record. The outPort is dynamic (source),
// so component.json declares no schema — the designer builds the variable picker
// from the options emitted under `generateOutputPortOptions`. Exporting the schema
// as ITEM_SCHEMA gives the offline tooling (`appmixer connector verify`,
// outport-nested-title-prefix) the same contract the static ports declare.
//
// Shape per https://console.groq.com/docs/api-reference#models-list: id, object,
// created and owned_by are on every record; active, context_window and
// max_completion_tokens are Groq extensions of the OpenAI model object.
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'object', 'created', 'owned_by'],
    properties: {
        id: { type: 'string', title: 'ID', example: 'llama-3.3-70b-versatile' },
        object: { type: 'string', title: 'Object', example: 'model' },
        created: { type: 'integer', title: 'Created', example: 1733447754 },
        owned_by: { type: 'string', title: 'Owned By', example: 'Meta' },
        active: { type: 'boolean', title: 'Active', example: true },
        context_window: { type: 'integer', title: 'Context Window', example: 131072 },
        max_completion_tokens: { type: 'integer', title: 'Max Completion Tokens', example: 32768 }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { outputType = 'array' } = context.messages.in.content || {};

        // Generate output port options dynamically if requested.
        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(
                context,
                outputType,
                ITEM_SCHEMA.properties,
                { label: 'Models' }
            );
        }

        // `isSource` is set by the model dropdowns of SendPrompt, CreateTranscription
        // and CreateTranslation. Opening an inspector fires one call per dropdown, so
        // the source path is cached and its errors are swallowed — the inputs are
        // typeaheads, so an empty list still lets the user type a model ID.
        const isSource = Boolean(context.properties && context.properties.isSource);

        let items;
        try {
            // https://console.groq.com/docs/api-reference#models-list
            const { data } = isSource
                ? await lib.requestCached({ context, path: '/models' })
                : await lib.request({ context, path: '/models' });
            items = data?.data ?? [];
        } catch (error) {
            if (isSource) {
                return context.sendJson({ result: [], count: 0 }, 'out');
            }
            throw error;
        }

        return lib.sendArrayOutput({
            context,
            records: items,
            outputType
        });
    },

    // Used by the model dropdowns of SendPrompt, CreateTranscription and CreateTranslation.
    toSelectArray({ result }) {
        return (result || []).map(model => ({ label: model.id, value: model.id }));
    }
};
