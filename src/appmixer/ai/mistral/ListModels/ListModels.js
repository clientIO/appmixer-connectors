'use strict';

const lib = require('../lib');

// Schema for a single model item. Mirrors the full /v1/models record — the API
// returns far more than the identifier and every field is useful downstream.
const schema = {
    id: { type: 'string', title: 'ID', example: 'mistral-small-latest' },
    name: { type: 'string', title: 'Name', example: 'mistral-small-2603' },
    description: {
        type: 'string',
        title: 'Description',
        example: 'Our frontier-class multimodal model released May 2025.'
    },
    object: { type: 'string', title: 'Object', example: 'model' },
    type: { type: 'string', title: 'Type', example: 'base' },
    created: { type: 'integer', title: 'Created', example: 1711430400 },
    owned_by: { type: 'string', title: 'Owned By', example: 'mistralai' },
    max_context_length: { type: 'integer', title: 'Max Context Length', example: 131072 },
    default_model_temperature: { type: 'number', title: 'Default Model Temperature', example: 0.3 },
    deprecation: { type: 'string', title: 'Deprecation Date', example: '2026-08-31T12:00:00Z' },
    deprecation_replacement_model: {
        type: 'string',
        title: 'Deprecation Replacement Model',
        example: 'mistral-medium-3-5'
    },
    aliases: {
        type: 'array',
        title: 'Aliases',
        items: { type: 'string' },
        example: ['mistral-small-2603']
    },
    capabilities: {
        type: 'object',
        title: 'Capabilities',
        properties: {
            completion_chat: { type: 'boolean', title: 'Chat Completion', example: true },
            completion_fim: { type: 'boolean', title: 'Fill In the Middle', example: false },
            function_calling: { type: 'boolean', title: 'Function Calling', example: true },
            reasoning: { type: 'boolean', title: 'Reasoning', example: false },
            vision: { type: 'boolean', title: 'Vision', example: true },
            ocr: { type: 'boolean', title: 'OCR', example: false },
            classification: { type: 'boolean', title: 'Classification', example: false },
            moderation: { type: 'boolean', title: 'Moderation', example: false },
            audio: { type: 'boolean', title: 'Audio', example: false },
            audio_transcription: { type: 'boolean', title: 'Audio Transcription', example: false },
            audio_speech: { type: 'boolean', title: 'Audio Speech', example: false },
            fine_tuning: { type: 'boolean', title: 'Fine Tuning', example: true }
        },
        example: { completion_chat: true, function_calling: true, vision: true }
    }
};

// Model dropdowns are per-capability: offering an embedding model in the vision
// component (or vice versa) only produces a runtime 400. Embedding models are
// the ones the API flags with no capability at all.
const CAPABILITY_FILTERS = {
    chat: model => Boolean(model.capabilities && model.capabilities.completion_chat),
    vision: model => Boolean(model.capabilities && model.capabilities.vision),
    ocr: model => Boolean(model.capabilities && model.capabilities.ocr),
    transcription: model => Boolean(model.capabilities && model.capabilities.audio_transcription),
    speech: model => Boolean(model.capabilities && model.capabilities.audio_speech),
    moderation: model => Boolean(model.capabilities && model.capabilities.moderation),
    embedding: model => !Object.values(model.capabilities || {}).some(Boolean)
};

const toOptions = (records, capability) => {
    const filter = CAPABILITY_FILTERS[capability];
    return (records || [])
        .filter(model => !filter || filter(model))
        .map(model => ({ label: model.id, value: model.id }));
};

module.exports = {

    async receive(context) {

        const { outputType = 'array' } = context.messages.in.content || {};

        // Generate output port options dynamically if requested.
        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Models' });
        }

        // Set when the component backs a model dropdown rather than a live flow.
        const isSource = Boolean(context.properties && context.properties.isSource);

        // https://docs.mistral.ai/api/#tag/models
        // Cached: this component also backs the model dropdowns of other components.
        let data;
        try {
            data = await lib.apiCallCached(context, '/models');
        } catch (err) {
            if (isSource) {
                // A dropdown must not raise an error popup every time an inspector is
                // opened with an unsaved key or while Mistral is down. The model inputs
                // are free text, so the user can always type the model id.
                return context.sendJson({ result: [], count: 0 }, 'out');
            }
            throw err;
        }
        const items = data?.data ?? [];

        return lib.sendArrayOutput({ context, records: items, outputType });
    },

    // Transforms used by the model dropdowns in other components' inspectors.
    toSelectArray({ result }) {
        return toOptions(result);
    },

    toChatModelSelectArray({ result }) {
        return toOptions(result, 'chat');
    },

    toVisionModelSelectArray({ result }) {
        return toOptions(result, 'vision');
    },

    toOcrModelSelectArray({ result }) {
        return toOptions(result, 'ocr');
    },

    toTranscriptionModelSelectArray({ result }) {
        return toOptions(result, 'transcription');
    },

    toSpeechModelSelectArray({ result }) {
        return toOptions(result, 'speech');
    },

    toModerationModelSelectArray({ result }) {
        return toOptions(result, 'moderation');
    },

    toEmbeddingModelSelectArray({ result }) {
        return toOptions(result, 'embedding');
    }
};
