'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { objectId, recordId, values, overwriteMultiselect } = context.messages.in.content;

        if (!objectId) {
            throw new context.CancelError('Object is required!');
        }
        if (!recordId) {
            throw new context.CancelError('Record ID is required!');
        }
        const parsedValues = lib.parseJsonObject(context, values, 'Values');
        if (!parsedValues) {
            throw new context.CancelError('Values is required!');
        }

        // PATCH appends values of multiselect attributes, PUT replaces them.
        await lib.apiRequest(context, {
            method: overwriteMultiselect ? 'PUT' : 'PATCH',
            path: '/v2/objects/' + encodeURIComponent(objectId) + '/records/' + encodeURIComponent(recordId),
            data: { data: { values: parsedValues } }
        });

        return context.sendJson({}, 'out');
    }
};
