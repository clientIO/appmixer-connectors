'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { listId, objectId, recordId, entryValues } = context.messages.in.content;

        if (!listId) {
            throw new context.CancelError('List is required!');
        }
        if (!objectId) {
            throw new context.CancelError('Record Object is required!');
        }
        if (!recordId) {
            throw new context.CancelError('Record ID is required!');
        }

        // PUT asserts the entry by its parent record: an existing entry is updated
        // instead of adding the record to the list a second time.
        const data = await lib.apiRequest(context, {
            method: 'PUT',
            path: '/v2/lists/' + encodeURIComponent(listId) + '/entries',
            data: {
                data: {
                    parent_record_id: recordId,
                    parent_object: objectId,
                    entry_values: lib.parseJsonObject(context, entryValues, 'Entry Values') || {}
                }
            }
        });

        return context.sendJson(lib.mapEntry(data.data), 'out');
    }
};
