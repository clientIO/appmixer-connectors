'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { listId, entryId } = context.messages.in.content;

        if (!listId) {
            throw new context.CancelError('List is required!');
        }
        if (!entryId) {
            throw new context.CancelError('Entry ID is required!');
        }

        await lib.apiRequest(context, {
            method: 'DELETE',
            path: '/v2/lists/' + encodeURIComponent(listId) + '/entries/' + encodeURIComponent(entryId)
        });

        return context.sendJson({}, 'out');
    }
};
