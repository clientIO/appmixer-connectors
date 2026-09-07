'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const {
            datasetId,
            input,
            includeErrors,
            customOutputFields
        } = context.messages.in.content;

        if (!datasetId) {
            throw new context.CancelError('Dataset ID is required!');
        }
        if (!input) {
            throw new context.CancelError('Input is required!');
        }

        const parsedInput = lib.parseJsonInput(context, input, 'Input');
        const records = Array.isArray(parsedInput) ? parsedInput : [parsedInput];

        if (records.length === 0) {
            throw new context.CancelError('Input must contain at least one item to collect.');
        }

        const params = {
            dataset_id: datasetId,
            format: 'json'
        };

        if (includeErrors) {
            params.include_errors = true;
        }
        if (customOutputFields) {
            params.custom_output_fields = customOutputFields;
        }

        const response = await lib.makeRequest({
            context,
            method: 'POST',
            path: '/datasets/v3/trigger',
            params,
            data: records
        });

        return context.sendJson({
            snapshotId: (response && response.snapshot_id) || null,
            datasetId
        }, 'out');
    }
};
