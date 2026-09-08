'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { snapshotId } = context.messages.in.content;

        if (!snapshotId) {
            throw new context.CancelError('Snapshot ID is required!');
        }

        const response = await lib.makeRequest({
            context,
            method: 'GET',
            path: `/datasets/v3/progress/${encodeURIComponent(snapshotId)}`
        });

        const status = (response && response.status) || null;

        return context.sendJson({
            snapshotId: (response && response.snapshot_id) || snapshotId,
            datasetId: (response && response.dataset_id) || null,
            status,
            // Saves every flow from re-implementing the same string comparison
            // before deciding whether it can download the records yet.
            isReady: status === 'ready'
        }, 'out');
    }
};
