'use strict';

const lib = require('../lib');

// Schema for a single voice item, exported as ITEM_SCHEMA because the `out` port is dynamic.
const ITEM_SCHEMA = {
    type: 'object',
    properties: {
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
    }
};

// Safety stop for the cursor loop below - far more pages than any account has voices,
// but it keeps a misbehaving cursor from looping forever.
const MAX_PAGES = 50;

// /v1/audio/voices returns only its first page and its offset paging is deprecated,
// so the voices come from /v2 by following next_page_token to the last page.
// https://docs.mistral.ai/api/endpoint/audio/voices
const loadAllVoices = async (context) => {

    const voices = [];
    let pageToken = null;
    for (let page = 0; page < MAX_PAGES; page++) {
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${lib.API_ORIGIN}/v2/audio/voices`,
            headers: lib.requestHeaders(context),
            params: pageToken ? { page_token: pageToken } : {}
        });
        voices.push(...(data?.data ?? []));
        pageToken = data?.next_page_token;
        if (!pageToken) {
            break;
        }
    }
    return voices;
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { outputType = 'array' } = (context.messages.in && context.messages.in.content) || {};

        // Generate output port options dynamically if requested.
        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Voices' });
        }

        // Set when the component backs the voice dropdown rather than a live flow.
        const isSource = Boolean(context.properties && context.properties.isSource);

        // Cached: this component also backs the voice dropdown of Create Speech.
        let items;
        try {
            items = await lib.apiCallCached(context, '/v2/audio/voices', loadAllVoices);
        } catch (err) {
            if (isSource) {
                // A dropdown must not raise an error popup every time an inspector is
                // opened with an unsaved key or while Mistral is down. The voice input
                // is free text, so the user can always type the slug.
                return context.sendJson({ result: [], count: 0 }, 'out');
            }
            throw err;
        }

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
