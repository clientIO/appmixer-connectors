'use strict';

const lib = require('../../lib');

// Schema of a single sandbox item.
const schema = {
    sandboxID: { type: 'string', title: 'Sandbox ID', example: 'i3xkz5qz8p6z9r2v4w7yq' },
    templateID: { type: 'string', title: 'Template ID', example: 'base' },
    alias: { type: 'string', title: 'Alias', example: 'base' },
    clientID: { type: 'string', title: 'Client ID', example: '3d3f5e9a' },
    state: { type: 'string', title: 'State', example: 'running' },
    cpuCount: { type: 'integer', title: 'CPU Count', example: 2 },
    memoryMB: { type: 'integer', title: 'Memory (MB)', example: 512 },
    startedAt: { type: 'string', title: 'Started At', example: '2026-07-09T10:30:00.000Z' },
    endAt: { type: 'string', title: 'End At', example: '2026-07-09T11:30:00.000Z' }
};

module.exports = {

    async receive(context) {

        const { state, outputType = 'array' } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Sandboxes' });
        }

        // The API allows a maximum limit of 100.
        const params = { limit: 100 };
        if (state) {
            params.state = state;
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${lib.BASE_URL}/v2/sandboxes`,
            headers: lib.authHeaders(context),
            params
        });

        // The endpoint may return a bare array or an object wrapping the array.
        const records = Array.isArray(data) ? data : (data.sandboxes || data.data || []);

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
