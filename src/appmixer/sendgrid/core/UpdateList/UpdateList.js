'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { listId, name } = context.messages.in.content;

        if (!listId) {
            throw new context.CancelError('List ID is required!');
        }

        if (!name) {
            throw new context.CancelError('Name is required!');
        }

        await lib.apiRequest(context, `/marketing/lists/${listId}`, {
            method: 'PATCH',
            data: { name }
        });

        return context.sendJson({}, 'out');
    }
};
