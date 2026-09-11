'use strict';

const lib = require('../../lib');

// The output contract of one session item. A dynamic (source) output port has no
// `schema` in component.json — the designer builds the variable picker from the
// options this component emits under `generateOutputPortOptions`. Exporting the schema
// as ITEM_SCHEMA gives the offline tooling the same contract the static ports declare:
// `appmixer connector validate` can check titles, types and examples, and
// `appmixer connector verify` can honour `required` per level instead of treating
// every field as mandatory.
//
// Shape verified against the live listing on 2026-09-03: the record is polymorphic by
// status. A running session carries the three connection URLs; an ended one carries
// only the identity and timestamps. `currentUsage` appears once the session has been
// running for a while — it is absent right after creation and on an ended session.
// Hence only `id` and `status` are required.
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'status'],
    properties: {
        id: { type: 'string', title: 'Session ID', example: '0a5b2c4e-9d31-4d2f-8f7a-6b1d9c3e5a77' },
        status: { type: 'string', title: 'Status', example: 'running' },
        dateCreated: { type: 'string', title: 'Date Created', example: '2026-08-25T09:12:44.000Z' },
        lastActivity: { type: 'string', title: 'Last Activity', example: '2026-08-25T09:14:02.000Z' },
        currentUsage: { type: 'integer', title: 'Current Usage (minutes)', example: 2 },
        cdpUrl: {
            type: 'string',
            title: 'CDP URL',
            example: 'https://api.airtop.ai/cdp/0a5b2c4e-9d31-4d2f-8f7a-6b1d9c3e5a77'
        },
        cdpWsUrl: {
            type: 'string',
            title: 'CDP WebSocket URL',
            example: 'wss://api.airtop.ai/cdpws/0a5b2c4e-9d31-4d2f-8f7a-6b1d9c3e5a77'
        },
        chromedriverUrl: {
            type: 'string',
            title: 'Chromedriver URL',
            example: 'https://api.airtop.ai/chromedriver/0a5b2c4e-9d31-4d2f-8f7a-6b1d9c3e5a77'
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { status, outputType = 'array' } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Sessions' });
        }

        // Return the maximum page the API serves in one call.
        const params = { limit: 100 };
        if (status) {
            params.status = status;
        }

        const { data } = await lib.apiRequest(context, {
            method: 'GET',
            path: '/sessions',
            params
        });

        const payload = lib.unwrap(context, data);
        const records = Array.isArray(payload.sessions) ? payload.sessions : [];

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
