'use strict';

const lib = require('../lib');

const schema = {
    'endpoint_id': { 'type': 'string', 'title': 'Endpoint Id', 'example': 'fal-ai/flux/schnell' },
    'display_name': { 'type': 'string', 'title': 'Display Name', 'example': 'FLUX.1 [schnell]' },
    'category': { 'type': 'string', 'title': 'Category', 'example': 'text-to-image' },
    'description': { 'type': 'string', 'title': 'Description', 'example': 'The fastest FLUX model.' },
    'status': { 'type': 'string', 'title': 'Status', 'example': 'active' },
    'tags': { 'type': 'array', 'title': 'Tags', 'items': { 'type': 'string' }, 'example': ['image'] },
    'updated_at': { 'type': 'string', 'title': 'Updated At', 'example': '2026-01-15T10:00:00.000Z' },
    'thumbnail_url': { 'type': 'string', 'title': 'Thumbnail URL', 'example': 'https://fal.media/thumb/abc.png' },
    'model_url': { 'type': 'string', 'title': 'Model URL', 'example': 'https://fal.ai/models/fal-ai/flux/schnell' },
    'license_type': { 'type': 'string', 'title': 'License Type', 'example': 'commercial' }
};

module.exports = {

    async receive(context) {

        const { query, category, status, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Models', value: 'result' });
        }

        const baseParams = {};
        if (query) {
            baseParams.q = query;
        }
        if (category) {
            baseParams.category = category;
        }
        if (status) {
            baseParams.status = status;
        }

        // Cursor-based pagination handled internally: follow next_cursor until the API
        // reports no more pages (capped to avoid runaway requests). fal has no offset.
        const MAX_PAGES = 20;
        const models = [];
        let cursor;
        for (let page = 0; page < MAX_PAGES; page++) {
            const params = { ...baseParams };
            if (cursor) {
                params.cursor = cursor;
            }

            const response = await lib.request(context, {
                method: 'GET',
                url: `${lib.PLATFORM_URL}/models`,
                headers: lib.authHeaders(context),
                params
            });

            const data = response.data || {};

            // The API nests everything except endpoint_id under `metadata`. Flatten it
            // so the records match the output schema declared above — otherwise every
            // field but endpoint_id would be unreachable in the variable picker.
            for (const model of data.models || []) {
                models.push({ endpoint_id: model.endpoint_id, ...(model.metadata || {}) });
            }

            if (!data.has_more || !data.next_cursor) {
                break;
            }
            cursor = data.next_cursor;
        }

        if (!models.length) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: models, outputType });
    }
};
