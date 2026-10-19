'use strict';

const lib = require('../lib');

// Schema for a single model item (flattened across stt + tts).
const schema = {
    category: { type: 'string', title: 'Category' },
    name: { type: 'string', title: 'Name' },
    canonical_name: { type: 'string', title: 'Canonical Name' },
    architecture: { type: 'string', title: 'Architecture' },
    languages: { type: 'array', title: 'Languages', items: { type: 'string' } },
    version: { type: 'string', title: 'Version' },
    uuid: { type: 'string', title: 'UUID' }
};

function flatten(data) {
    if (Array.isArray(data)) {
        return data;
    }
    const stt = (data.stt || []).map(m => ({ category: 'stt', ...m }));
    const tts = (data.tts || []).map(m => ({ category: 'tts', ...m }));
    return [...stt, ...tts];
}

module.exports = {

    async receive(context) {

        const { outputType = 'array', isSource } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Models' });
        }

        // Not a source call - always hit the API and let errors reach the flow.
        if (!isSource) {
            const { data } = await lib.apiRequest(context, {
                method: 'GET',
                path: '/v1/models'
            });
            return lib.sendArrayOutput({ context, records: flatten(data || {}), outputType });
        }

        // Source call: this component backs the STT model and TTS voice dropdowns.
        // Cache per host + key for a short TTL behind a lock so opening inspectors
        // does not repeatedly hit /v1/models, and swallow errors so setup-time
        // failures do not surface as designer errors.
        const cacheKey = `deepgram_models_${lib.getBaseUrl(context.auth, context)}_${context.auth.apiKey}`;
        let lock;

        try {
            lock = await context.lock(cacheKey);

            const cached = await context.staticCache.get(cacheKey);
            if (cached) {
                return context.sendJson({ result: cached }, 'out');
            }

            const { data } = await lib.apiRequest(context, {
                method: 'GET',
                path: '/v1/models'
            });

            const records = flatten(data || {});

            // Only the fields the selectors need, to keep the cache small.
            await context.staticCache.set(
                cacheKey,
                records.map(model => ({
                    category: model.category,
                    name: model.name,
                    canonical_name: model.canonical_name
                })),
                context.config.listModelsCacheTTL || (60 * 1000)
            );

            return context.sendJson({ result: records }, 'out');

        } catch (error) {
            // A dropdown cannot do anything useful with an error - render it empty.
            return context.sendJson({ result: [] }, 'out');
        } finally {
            lock?.unlock();
        }
    },

    // STT models only (used by the Model dropdown on both Transcribe Audio components).
    // `category` is absent when Deepgram returns a flat array, so exclude TTS rather
    // than requiring an explicit `stt` marker.
    toSelectArray({ result }) {
        return (result || [])
            .filter(model => model.category !== 'tts')
            .map(model => ({
                label: `${model.name} (${model.canonical_name})`,
                value: model.canonical_name
            }));
    },

    // TTS voices only (used by the voice dropdown on Text to Speech).
    toTtsSelectArray({ result }) {
        return (result || [])
            .filter(model => model.category === 'tts')
            .map(model => ({
                label: `${model.name} (${model.canonical_name})`,
                value: model.canonical_name
            }));
    }
};
