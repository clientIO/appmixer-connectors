'use strict';

const lib = require('../../lib');

// The shape of a snapshot record is defined by the dataset that produced it, so
// only the housekeeping fields Bright Data adds to every dataset can be declared
// up front. Dataset specific fields still arrive on the wire — reach them with a
// JSON path modifier on the array output.
const schema = {
    'url': { 'type': 'string', 'title': 'URL', 'example': 'https://www.airbnb.com/rooms/50122531' },
    'input': {
        'type': 'object',
        'title': 'Input',
        'properties': {},
        'example': { 'url': 'https://www.airbnb.com/rooms/50122531' }
    },
    'timestamp': { 'type': 'string', 'title': 'Collected At', 'example': '2026-08-25T09:14:03.117Z' },
    'error': { 'type': 'string', 'title': 'Error', 'example': 'dead_page' },
    'error_code': { 'type': 'string', 'title': 'Error Code', 'example': 'ERR_DEAD_PAGE' },
    'warning': { 'type': 'string', 'title': 'Warning', 'example': 'partial_data' }
};

module.exports = {

    async receive(context) {

        const { snapshotId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Records' });
        }

        if (!snapshotId) {
            throw new context.CancelError('Snapshot ID is required!');
        }

        const response = await lib.makeRequest({
            context,
            method: 'GET',
            path: `/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}`,
            params: { format: 'json' }
        });

        const payload = lib.parseMaybeJson(response);

        // A snapshot that is still collecting answers 200/202 with a status object
        // instead of the records array. Failing loudly beats emitting nothing.
        if (!Array.isArray(payload)) {
            const status = (payload && payload.status) || 'unknown';
            throw new context.CancelError(
                `Snapshot ${snapshotId} is not ready to download yet (status: ${status}).`
            );
        }

        if (payload.length === 0) {
            return context.sendJson({ snapshotId }, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: payload, outputType });
    }
};
