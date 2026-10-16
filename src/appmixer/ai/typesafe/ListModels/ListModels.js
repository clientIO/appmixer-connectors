'use strict';

const lib = require('../lib');

// The output contract of one TypeSafe model record (GET /v1/models,
// https://docs.typesafe.ai/models). The outPort is dynamic (source), so
// component.json declares no schema — exporting it as ITEM_SCHEMA gives the
// offline tooling the same contract the static ports declare.
const ITEM_SCHEMA = {
    type: 'object',
    properties: {
        name: { type: 'string', title: 'Name', example: 'jev-latest' },
        description: {
            type: 'string',
            title: 'Description',
            example: 'The latest iteration of TypeSafe\'s System One Model: Jev'
        },
        release_date: {
            type: 'string',
            format: 'date-time',
            title: 'Release Date',
            example: '2026-09-10T18:38:01.391457+00:00'
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { outputType = 'array' } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(
                context,
                outputType,
                ITEM_SCHEMA.properties,
                { label: 'Models' }
            );
        }

        // `isSource` is set by the Model inputs of the decision components. Opening
        // an inspector fires one call per input, so the source path is cached and
        // its errors are swallowed — the inputs are typeaheads, so an empty list
        // still lets the user type a model name.
        const isSource = Boolean(context.properties && context.properties.isSource);

        let items;
        try {
            const { data } = isSource
                ? await lib.requestCached({ context, path: '/v1/models' })
                : await lib.request({ context, path: '/v1/models' });
            // The API wraps the list: `{ models: [...] }`.
            items = Array.isArray(data) ? data : (data?.models ?? []);
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

    // Used by the Model inputs of Classify Text, Score Text, Verify Statement and Ask Questions.
    toSelectArray({ result }) {

        const models = (result || []).map(model => ({ label: model.name, value: model.name }));
        // The aliases are not necessarily listed by the API but are the recommended values.
        // Reverse order because of unshift: jev-latest ends up first.
        ['jev-preview', 'jev-latest'].forEach(alias => {
            if (!models.some(model => model.value === alias)) {
                models.unshift({ label: alias, value: alias });
            }
        });
        return models;
    }
};
