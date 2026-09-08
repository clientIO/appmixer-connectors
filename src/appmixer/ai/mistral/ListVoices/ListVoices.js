'use strict';

const lib = require('../lib');

// Schema for a single voice item.
const schema = {
    id: { type: 'string', title: 'ID', example: 'c69964a6-ab8b-4f8a-9465-ec0925096ec8' },
    name: { type: 'string', title: 'Name', example: 'Paul - Neutral' },
    slug: { type: 'string', title: 'Slug', example: 'en_paul_neutral' },
    gender: { type: 'string', title: 'Gender', example: 'male' },
    age: { type: 'integer', title: 'Age', example: 30 },
    description: { type: 'string', title: 'Description', example: 'A calm, balanced narration voice.' },
    sharing_scope: { type: 'string', title: 'Sharing Scope', example: 'private' },
    created_at: { type: 'string', title: 'Created At', example: '2026-03-24T15:31:20.081769Z' },
    languages: {
        type: 'array',
        title: 'Languages',
        items: { type: 'string' },
        example: ['en_us']
    },
    tags: {
        type: 'array',
        title: 'Tags',
        items: { type: 'string' },
        example: ['relaxed', 'balanced', 'neutral']
    }
};

module.exports = {

    async receive(context) {

        const { outputType = 'array' } = context.messages.in.content || {};

        // Generate output port options dynamically if requested.
        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Voices' });
        }

        // Set when the component backs the voice dropdown rather than a live flow.
        const isSource = Boolean(context.properties && context.properties.isSource);

        // https://docs.mistral.ai/api/#tag/audio-voices
        // Cached: this component also backs the voice dropdown of Create Speech.
        let data;
        try {
            data = await lib.apiCallCached(context, '/audio/voices');
        } catch (err) {
            if (isSource) {
                // A dropdown must not raise an error popup every time an inspector is
                // opened with an unsaved key or while Mistral is down. The voice input
                // is free text, so the user can always type the slug.
                return context.sendJson({ result: [], count: 0 }, 'out');
            }
            throw err;
        }
        const items = data?.items ?? [];

        return lib.sendArrayOutput({ context, records: items, outputType });
    },

    // Used by the voice dropdown in the Create Speech inspector. The API accepts
    // both the slug and the UUID; the slug is offered because it is readable.
    toSelectArray({ result }) {
        return (result || []).map(voice => ({
            label: voice.name || voice.slug,
            value: voice.slug || voice.id
        }));
    }
};
