'use strict';

const lib = require('../lib');

// The Hub search endpoint caps a single page at 100 items. Appmixer does not
// expose limit/offset inputs on Find components, so we always ask for the
// maximum page and return it.
const PAGE_SIZE = 100;

// Schema of a single Hub model record. Shared by the live path and the
// generateOutputPortOptions path so the designer always shows what is sent.
const schema = {
    'id': { 'type': 'string', 'title': 'Model ID', 'example': 'meta-llama/Llama-3.1-8B-Instruct' },
    'author': { 'type': 'string', 'title': 'Author', 'example': 'meta-llama' },
    'pipelineTag': { 'type': 'string', 'title': 'Pipeline Tag', 'example': 'text-generation' },
    'libraryName': { 'type': 'string', 'title': 'Library', 'example': 'transformers' },
    'downloads': { 'type': 'integer', 'title': 'Downloads (last 30 days)', 'example': 1204553 },
    'likes': { 'type': 'integer', 'title': 'Likes', 'example': 4021 },
    'trendingScore': { 'type': 'number', 'title': 'Trending Score', 'example': 12.5 },
    'private': { 'type': 'boolean', 'title': 'Private', 'example': false },
    'gated': { 'type': 'string', 'title': 'Gated', 'example': 'manual' },
    'tags': {
        'type': 'array',
        'title': 'Tags',
        'items': { 'type': 'string' },
        'example': ['transformers', 'safetensors', 'llama', 'text-generation']
    },
    'createdAt': {
        'type': 'string',
        'format': 'date-time',
        'title': 'Created At',
        'example': '2024-07-14T08:00:00.000Z'
    },
    'url': {
        'type': 'string',
        'title': 'Model URL',
        'example': 'https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct'
    }
};

module.exports = {

    async receive(context) {

        // A dropdown source call arrives without an input message, so the content is
        // read defensively here.
        const {
            search,
            author,
            pipelineTag,
            filter,
            sort,
            direction,
            outputType
        } = (context.messages.in && context.messages.in.content) || {};

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Models' });
        }

        // Set when the component backs a `modelId` dropdown rather than a live flow.
        const isSource = Boolean(context.properties.isSource);

        // The Hub takes `filter` as a REPEATED query parameter (filter=a&filter=b).
        // The default axios serializer would emit `filter[]=a&filter[]=b`, which the
        // Hub does not recognise, so the query string is built by hand here.
        const query = new URLSearchParams();
        query.append('limit', String(PAGE_SIZE));

        if (search) {
            query.append('search', search);
        }
        if (author) {
            query.append('author', author);
        }
        if (pipelineTag) {
            query.append('pipeline_tag', pipelineTag);
        }

        for (const tag of lib.toList(filter) || []) {
            query.append('filter', tag);
        }

        // A dropdown showing 100 arbitrary repos out of the ~2M on the Hub is close to
        // useless, so an unsorted source call falls back to the most downloaded models.
        const effectiveSort = sort || (isSource ? 'downloads' : null);

        if (effectiveSort) {
            query.append('sort', effectiveSort);
            // The Hub expects direction=-1 for descending; ascending is the default.
            if (direction !== 'asc') {
                query.append('direction', '-1');
            }
        }

        const request = { context, path: `/api/models?${query.toString()}` };

        let models;
        try {
            // Source calls fire in a burst per inspector open, so they read through the cache.
            models = isSource ? await lib.makeRequestCached(request) : await lib.makeRequest(request);
        } catch (error) {
            if (isSource) {
                // A failing dropdown must not raise an error popup in the designer - the
                // field is free text, so the user can always type the model ID.
                return context.sendJson({ result: [], count: 0 }, 'out');
            }
            throw error;
        }

        const records = (Array.isArray(models) ? models : []).map(model => {
            const id = model.id || model.modelId;
            return {
                id,
                author: model.author || String(id || '').split('/')[0],
                pipelineTag: model.pipeline_tag || null,
                libraryName: model.library_name || null,
                downloads: model.downloads || 0,
                likes: model.likes || 0,
                trendingScore: model.trendingScore || 0,
                private: Boolean(model.private),
                gated: lib.normalizeGated(model.gated),
                tags: model.tags || [],
                createdAt: model.createdAt || null,
                url: `${lib.HUB_API_BASE_URL}/${id}`
            };
        });

        if (records.length === 0) {
            if (isSource) {
                return context.sendJson({ result: [], count: 0 }, 'out');
            }
            return context.sendJson({}, 'notFound');
        }

        if (isSource) {
            return context.sendJson({ result: records, count: records.length }, 'out');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    },

    /**
     * Turn the `out` payload into the { label, value } pairs an inspector dropdown
     * expects. Referenced from GetModel's `modelId` source block.
     * @param {object} out the component's `out` message content
     * @returns {array}
     */
    toSelectArray(out) {

        return ((out && out.result) || []).map(model => ({
            label: model.id,
            value: model.id
        }));
    }
};
