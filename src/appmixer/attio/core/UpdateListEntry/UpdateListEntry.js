'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { listId, entryId, entryValues, overwriteMultiselect } = context.messages.in.content;

        if (!listId) {
            throw new context.CancelError('List is required!');
        }
        if (!entryId) {
            throw new context.CancelError('Entry ID is required!');
        }
        const parsedValues = lib.parseJsonObject(context, entryValues, 'Entry Values');
        if (!parsedValues) {
            throw new context.CancelError('Entry Values is required!');
        }

        // PATCH appends values of multiselect attributes, PUT replaces them.
        await lib.apiRequest(context, {
            method: overwriteMultiselect ? 'PUT' : 'PATCH',
            path: '/v2/lists/' + encodeURIComponent(listId) + '/entries/' + encodeURIComponent(entryId),
            data: { data: { entry_values: parsedValues } }
        });

        return context.sendJson({}, 'out');
    }
};
